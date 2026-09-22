"use client";

import { create } from "zustand";
import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { encodeHgClient, parseHgClient } from "@/lib/nms/client";
import { detect } from "@/lib/nms/detect";
import {
  getAdapter,
  listAllCategories,
  listShips,
  type ExtractedShip,
  type ExtractedSlot,
} from "@/lib/nms/extract";
import { sha256Hex } from "@/lib/sha256";
import {
  parseMappingFile,
  type MappingFile,
} from "@/lib/nms/mapping";
import {
  summarizePlayer,
  type PlayerSummary,
} from "@/lib/nms/player";
import {
  insertCategoryItem,
  reorderCategorySlots,
  clearCategorySlot,
  setPlayerCurrencies,
  type PlayerCurrencies,
} from "@/lib/nms/write";
import {
  buildNmsItem,
  type NmsItemFile,
} from "@/lib/nmsitem";
import { isCategory, type Category } from "@/types/nms";

const IDB_JSON = "nmsarchive:v1:mapped-json";
const IDB_ORIGINAL = "nmsarchive:v1:original-hg";
const IDB_MAPPING = "nmsarchive:v1:mapping";
const IDB_META = "nmsarchive:v1:meta";

type SessionMeta = {
  fileName: string;
  unknownKeys: string[];
  mappingVersion: string;
  sha256?: string;
  formatHint?: string;
};

type Status = "idle" | "hydrating" | "loading" | "ready" | "error";

type ItemsByCategory = Record<Category, ExtractedSlot[]>;

function emptyItems(): ItemsByCategory {
  return {
    ship: [],
    multitool: [],
    companion: [],
    exosuit: [],
    freighter: [],
    frigate: [],
    base: [],
    deepspace: [],
    spacestation: [],
    wonder: [],
  };
}

type SaveSessionState = {
  status: Status;
  hydrated: boolean;
  error: string | null;
  fileName: string | null;
  mappingVersion: string | null;
  sha256: string | null;
  formatHint: string | null;
  unknownKeys: string[];
  summary: PlayerSummary | null;
  ships: ExtractedShip[];
  items: ItemsByCategory;
  hydrate: () => Promise<void>;
  loadFile: (file: File) => Promise<void>;
  clear: () => Promise<void>;
  importItem: (item: NmsItemFile) => Promise<number>;
  importShip: (item: NmsItemFile) => Promise<number>;
  clearSlot: (category: Category, index: number) => Promise<void>;
  exportItem: (category: Category, index: number) => NmsItemFile;
  exportShip: (index: number) => NmsItemFile;
  exportAllShips: () => NmsItemFile[];
  reorderSlots: (category: Category, from: number, to: number) => Promise<void>;
  reorderShips: (from: number, to: number) => Promise<void>;
  updateCurrencies: (coins: Partial<PlayerCurrencies>) => Promise<void>;
  downloadRewritten: () => Promise<Uint8Array>;
  downloadOriginal: () => Uint8Array;
};

let mappedJson: unknown | null = null;
let originalBytes: Uint8Array | null = null;
let mappingFile: MappingFile | null = null;

export function getMappedJson(): unknown | null {
  return mappedJson;
}

async function fetchMapping(): Promise<MappingFile> {
  const res = await fetch("/api/mapping");
  if (!res.ok) {
    throw new Error("Não foi possível obter mapping.json do MBINCompiler.");
  }
  return parseMappingFile(await res.json());
}

function applyParsed(
  json: unknown,
  extra: Partial<SaveSessionState>,
): Partial<SaveSessionState> {
  const items = listAllCategories(json);
  return {
    status: "ready",
    error: null,
    summary: summarizePlayer(json),
    ships: listShips(json),
    items,
    ...extra,
  };
}

function assertSaveFile(file: File) {
  const name = file.name.toLowerCase();
  if (name.startsWith("mf_")) {
    throw new Error(
      "Isso parece um mf_save. Escolha o save.hg, não o arquivo de metadata.",
    );
  }
}

function persistJson() {
  if (mappedJson == null) throw new Error("Nenhum save aberto.");
  return idbSet(IDB_JSON, mappedJson);
}

export const useSaveSession = create<SaveSessionState>((set, get) => ({
  status: "idle",
  hydrated: false,
  error: null,
  fileName: null,
  mappingVersion: null,
  sha256: null,
  formatHint: null,
  unknownKeys: [],
  summary: null,
  ships: [],
  items: emptyItems(),

  hydrate: async () => {
    if (get().hydrated) return;
    set({ status: "hydrating" });
    try {
      const [json, original, mapping, meta] = await Promise.all([
        idbGet(IDB_JSON),
        idbGet(IDB_ORIGINAL),
        idbGet(IDB_MAPPING),
        idbGet(IDB_META),
      ]);
      if (json != null && original && mapping && meta) {
        mappedJson = json;
        originalBytes = original as Uint8Array;
        mappingFile = mapping as MappingFile;
        const sessionMeta = meta as SessionMeta;
        const sha256 =
          sessionMeta.sha256 ?? (await sha256Hex(originalBytes));
        const formatHint = sessionMeta.formatHint ?? detect(originalBytes);
        if (!sessionMeta.sha256) {
          await idbSet(IDB_META, { ...sessionMeta, sha256, formatHint });
        }
        set(
          applyParsed(json, {
            hydrated: true,
            fileName: sessionMeta.fileName,
            unknownKeys: sessionMeta.unknownKeys,
            mappingVersion: sessionMeta.mappingVersion,
            sha256,
            formatHint,
          }),
        );
        return;
      }
    } catch {
      // IndexedDB indisponível — segue sem sessão
    }
    set({ status: "idle", hydrated: true });
  },

  loadFile: async (file) => {
    assertSaveFile(file);
    set({ status: "loading", error: null });
    try {
      const [buffer, mapping] = await Promise.all([
        file.arrayBuffer(),
        fetchMapping(),
      ]);
      const bytes = new Uint8Array(buffer);
      const parsed = await parseHgClient(bytes, mapping);
      const sha256 = await sha256Hex(bytes);
      const formatHint = detect(bytes);
      mappedJson = parsed.json;
      originalBytes = bytes;
      mappingFile = mapping;
      const meta: SessionMeta = {
        fileName: file.name,
        unknownKeys: parsed.unknownKeys,
        mappingVersion: parsed.mappingVersion,
        sha256,
        formatHint,
      };
      await Promise.all([
        idbSet(IDB_JSON, parsed.json),
        idbSet(IDB_ORIGINAL, bytes),
        idbSet(IDB_MAPPING, mapping),
        idbSet(IDB_META, meta),
      ]);
      set(
        applyParsed(parsed.json, {
          fileName: file.name,
          unknownKeys: parsed.unknownKeys,
          mappingVersion: parsed.mappingVersion,
          sha256,
          formatHint,
        }),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao ler o save.";
      set({ status: get().summary ? "ready" : "error", error: message });
      throw err;
    }
  },

  clear: async () => {
    mappedJson = null;
    originalBytes = null;
    mappingFile = null;
    await Promise.all([
      idbDel(IDB_JSON),
      idbDel(IDB_ORIGINAL),
      idbDel(IDB_MAPPING),
      idbDel(IDB_META),
    ]);
    set({
      status: "idle",
      error: null,
      fileName: null,
      mappingVersion: null,
      sha256: null,
      formatHint: null,
      unknownKeys: [],
      summary: null,
      ships: [],
      items: emptyItems(),
    });
  },

  importItem: async (item) => {
    if (mappedJson == null || !mappingFile) {
      throw new Error("Nenhum save aberto.");
    }
    if (!isCategory(item.category)) {
      throw new Error("Categoria desconhecida neste arquivo.");
    }
    const result = insertCategoryItem(
      mappedJson,
      item.category,
      item.payload,
      item.seed,
    );
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await persistJson();
    set(applyParsed(mappedJson, {}));
    return result.index;
  },

  importShip: async (item) => get().importItem(item),

  clearSlot: async (category, index) => {
    if (mappedJson == null) throw new Error("Nenhum save aberto.");
    const result = clearCategorySlot(mappedJson, category, index);
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await persistJson();
    set(applyParsed(mappedJson, {}));
  },

  exportItem: (category, index) => {
    const { items, summary } = get();
    const slot = items[category].find((s) => s.index === index);
    if (!slot || slot.empty || slot.readonly || !summary) {
      throw new Error("Item não encontrado.");
    }
    return buildNmsItem({
      category,
      name: slot.name,
      seed: slot.seed || "0x0",
      payload: slot.payload,
      gameVersion: summary.gameVersion,
      galaxy: summary.galaxy,
    });
  },

  exportShip: (index) => get().exportItem("ship", index),

  exportAllShips: () => {
    const { ships, summary } = get();
    if (!summary) throw new Error("Nenhum save aberto.");
    return ships
      .filter((ship) => !ship.empty)
      .map((ship) =>
        buildNmsItem({
          category: "ship",
          name: ship.name,
          seed: ship.seed,
          payload: ship.payload,
          gameVersion: summary.gameVersion,
          galaxy: summary.galaxy,
        }),
      );
  },

  reorderSlots: async (category, from, to) => {
    if (mappedJson == null) throw new Error("Nenhum save aberto.");
    if (from === to) return;
    const adapter = getAdapter(category);
    if (!adapter.reorder) {
      throw new Error("Esta categoria não reordena.");
    }
    const result = reorderCategorySlots(mappedJson, category, from, to);
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await persistJson();
    set(applyParsed(mappedJson, {}));
  },

  reorderShips: async (from, to) => get().reorderSlots("ship", from, to),

  updateCurrencies: async (coins) => {
    if (mappedJson == null) throw new Error("Nenhum save aberto.");
    const result = setPlayerCurrencies(mappedJson, coins);
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await persistJson();
    set(applyParsed(mappedJson, {}));
  },

  downloadRewritten: async () => {
    if (mappedJson == null || !mappingFile) {
      throw new Error("Nenhum save aberto.");
    }
    return encodeHgClient(mappedJson, mappingFile);
  },

  downloadOriginal: () => {
    if (!originalBytes) throw new Error("Bytes originais indisponíveis.");
    return originalBytes;
  },
}));
