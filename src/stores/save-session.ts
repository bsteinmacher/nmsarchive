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
  hasExpeditionContext,
  initialSaveContext,
  summarizePlayer,
  type PlayerSummary,
  type SaveContext,
} from "@/lib/nms/player";
import {
  applyCategoryItem,
  reorderCategorySlots,
  clearCategorySlot,
  setPlayerCurrencies,
  type PlayerCurrencies,
} from "@/lib/nms/write";
import type { ApplyRequest } from "@/lib/nms/extract/apply-depth";
import {
  buildNmsItem,
  type NmsItemFile,
} from "@/lib/nmsitem";
import { isCategory, type Category } from "@/types/nms";
import {
  openActivityRail,
  pushSessionActivity,
} from "@/stores/session-activity";

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
  origin?: "directory" | "upload";
  diskModified?: number | null;
  dirty?: boolean;
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
    squadron: [],
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
  origin: "directory" | "upload" | null;
  diskModified: number | null;
  unknownKeys: string[];
  saveContext: SaveContext;
  expeditionAvailable: boolean;
  dirty: boolean;
  summary: PlayerSummary | null;
  ships: ExtractedShip[];
  items: ItemsByCategory;
  hydrate: () => Promise<void>;
  loadFile: (
    file: File,
    source?: { origin?: "directory" | "upload" },
  ) => Promise<void>;
  setSaveContext: (context: SaveContext) => void;
  previewFile: (file: File) => Promise<PlayerSummary>;
  noteDiskWrite: (diskModified: number, bytes: Uint8Array) => Promise<void>;
  clear: () => Promise<void>;
  importItem: (item: NmsItemFile, options?: ApplyRequest) => Promise<number>;
  importShip: (item: NmsItemFile, options?: ApplyRequest) => Promise<number>;
  clearSlot: (category: Category, index: number) => Promise<void>;
  exportItem: (category: Category, index: number) => NmsItemFile;
  exportShip: (index: number) => NmsItemFile;
  exportAllShips: () => NmsItemFile[];
  reorderSlots: (category: Category, from: number, to: number) => Promise<void>;
  reorderShips: (from: number, to: number) => Promise<void>;
  updateCurrencies: (coins: Partial<PlayerCurrencies>) => Promise<void>;
  downloadRewritten: () => Promise<Uint8Array>;
  downloadOriginal: () => Uint8Array;
  reparseOpenSave: () => Promise<boolean>;
};

let mappedJson: unknown | null = null;
let originalBytes: Uint8Array | null = null;
let mappingFile: MappingFile | null = null;

export function getMappedJson(): unknown | null {
  return mappedJson;
}

async function fetchMapping(): Promise<MappingFile> {
  const res = await fetch("/api/mapping", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Não foi possível obter mapping.json do MBINCompiler.");
  }
  return parseMappingFile(await res.json());
}

function applyParsed(
  json: unknown,
  context: SaveContext,
  extra: Partial<SaveSessionState>,
): Partial<SaveSessionState> {
  return {
    status: "ready",
    error: null,
    saveContext: context,
    expeditionAvailable: hasExpeditionContext(json),
    summary: summarizePlayer(json, context),
    ships: listShips(json, context),
    items: listAllCategories(json, context),
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

async function rememberDirty(dirty: boolean) {
  if (dirty) openActivityRail();
  const previous = (await idbGet(IDB_META)) as SessionMeta | undefined;
  if (!previous) return;
  await idbSet(IDB_META, { ...previous, dirty });
}

function sessionNames(state: {
  fileName: string | null;
  summary: PlayerSummary | null;
}) {
  return { fileName: state.fileName, saveName: state.summary?.saveName };
}

export const useSaveSession = create<SaveSessionState>((set, get) => ({
  status: "idle",
  hydrated: false,
  error: null,
  fileName: null,
  mappingVersion: null,
  sha256: null,
  formatHint: null,
  origin: null,
  diskModified: null,
  unknownKeys: [],
  saveContext: "main",
  expeditionAvailable: false,
  dirty: false,
  summary: null,
  ships: [],
  items: emptyItems(),

  hydrate: async () => {
    if (get().hydrated) return;
    set({ status: "hydrating" });
    try {
      await get().clear();
    } catch {
      // IndexedDB indisponível — segue sem sessão
    }
    set({ status: "idle", hydrated: true });
  },

  loadFile: async (file, source) => {
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
      const origin = source?.origin ?? "upload";
      mappedJson = parsed.json;
      originalBytes = bytes;
      mappingFile = mapping;
      const meta: SessionMeta = {
        fileName: file.name,
        unknownKeys: parsed.unknownKeys,
        mappingVersion: parsed.mappingVersion,
        sha256,
        formatHint,
        origin,
        diskModified: origin === "directory" ? file.lastModified : null,
        dirty: false,
      };
      await Promise.all([
        idbSet(IDB_JSON, parsed.json),
        idbSet(IDB_ORIGINAL, bytes),
        idbSet(IDB_MAPPING, mapping),
        idbSet(IDB_META, meta),
      ]);
      set(
        applyParsed(parsed.json, initialSaveContext(parsed.json), {
          fileName: file.name,
          unknownKeys: parsed.unknownKeys,
          mappingVersion: parsed.mappingVersion,
          sha256,
          formatHint,
          origin: meta.origin ?? null,
          diskModified: meta.diskModified ?? null,
          dirty: false,
        }),
      );
      pushSessionActivity("open", {
        fileName: file.name,
        saveName: get().summary?.saveName,
      });
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
      origin: null,
      diskModified: null,
      unknownKeys: [],
      saveContext: "main",
      expeditionAvailable: false,
      dirty: false,
      summary: null,
      ships: [],
      items: emptyItems(),
    });
  },

  setSaveContext: (context) => {
    if (mappedJson == null) return;
    if (context === "expedition" && !hasExpeditionContext(mappedJson)) return;
    if (context === get().saveContext) return;
    set(applyParsed(mappedJson, context, {}));
  },

  importItem: async (item, options) => {
    if (mappedJson == null || !mappingFile) {
      throw new Error("Nenhum save aberto.");
    }
    if (!isCategory(item.category)) {
      throw new Error("Categoria desconhecida neste arquivo.");
    }
    const context = get().saveContext;
    const result = applyCategoryItem(
      mappedJson,
      item.category,
      item.payload,
      item.seed,
      context,
      options,
    );
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await persistJson();
    await rememberDirty(true);
    set(applyParsed(mappedJson, context, { dirty: true }));
    pushSessionActivity("change", {
      ...sessionNames(get()),
      label: `Aplicou ${item.name}`,
    });
    return result.index;
  },

  importShip: async (item, options) => get().importItem(item, options),

  clearSlot: async (category, index) => {
    if (mappedJson == null) throw new Error("Nenhum save aberto.");
    const context = get().saveContext;
    const result = clearCategorySlot(mappedJson, category, index, context);
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await persistJson();
    await rememberDirty(true);
    set(applyParsed(mappedJson, context, { dirty: true }));
    pushSessionActivity("change", {
      ...sessionNames(get()),
      label: `Esvaziou o slot ${index + 1}`,
    });
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
    const context = get().saveContext;
    const result = reorderCategorySlots(mappedJson, category, from, to, context);
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await persistJson();
    await rememberDirty(true);
    set(applyParsed(mappedJson, context, { dirty: true }));
    pushSessionActivity("change", {
      ...sessionNames(get()),
      label: "Reordenou",
    });
  },

  reorderShips: async (from, to) => get().reorderSlots("ship", from, to),

  updateCurrencies: async (coins) => {
    if (mappedJson == null) throw new Error("Nenhum save aberto.");
    const context = get().saveContext;
    const result = setPlayerCurrencies(mappedJson, coins, context);
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await persistJson();
    await rememberDirty(true);
    set(applyParsed(mappedJson, context, { dirty: true }));
    pushSessionActivity("change", {
      ...sessionNames(get()),
      label: "Editou moedas",
    });
  },

  previewFile: async (file) => {
    assertSaveFile(file);
    const mapping = mappingFile ?? (await fetchMapping());
    if (!mappingFile) mappingFile = mapping;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseHgClient(bytes, mapping);
    return summarizePlayer(parsed.json, initialSaveContext(parsed.json));
  },

  noteDiskWrite: async (diskModified, bytes) => {
    const sha256 = await sha256Hex(bytes);
    originalBytes = bytes;
    const previous = (await idbGet(IDB_META)) as SessionMeta | undefined;
    const meta: SessionMeta = {
      fileName: previous?.fileName ?? get().fileName ?? "save.hg",
      unknownKeys: previous?.unknownKeys ?? get().unknownKeys,
      mappingVersion: previous?.mappingVersion ?? get().mappingVersion ?? "",
      sha256,
      formatHint: previous?.formatHint ?? get().formatHint ?? undefined,
      origin: "directory",
      diskModified,
      dirty: false,
    };
    await Promise.all([idbSet(IDB_META, meta), idbSet(IDB_ORIGINAL, bytes)]);
    set({ diskModified, sha256, origin: "directory", dirty: false });
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

  reparseOpenSave: async () => {
    if (get().dirty || !originalBytes) return false;
    const mapping = await fetchMapping();
    const parsed = await parseHgClient(originalBytes, mapping);
    mappedJson = parsed.json;
    mappingFile = mapping;
    const previous = (await idbGet(IDB_META)) as SessionMeta | undefined;
    const meta: SessionMeta = {
      fileName: previous?.fileName ?? get().fileName ?? "save.hg",
      unknownKeys: parsed.unknownKeys,
      mappingVersion: parsed.mappingVersion,
      sha256: previous?.sha256 ?? get().sha256 ?? undefined,
      formatHint: previous?.formatHint ?? get().formatHint ?? undefined,
      origin: previous?.origin ?? get().origin ?? undefined,
      diskModified: previous?.diskModified ?? get().diskModified,
      dirty: false,
    };
    await Promise.all([
      idbSet(IDB_JSON, parsed.json),
      idbSet(IDB_MAPPING, mapping),
      idbSet(IDB_META, meta),
    ]);
    const preferred = get().saveContext;
    const context =
      preferred === "expedition" && !hasExpeditionContext(parsed.json)
        ? "main"
        : preferred;
    set(
      applyParsed(parsed.json, context, {
        unknownKeys: parsed.unknownKeys,
        mappingVersion: parsed.mappingVersion,
        dirty: false,
      }),
    );
    return true;
  },
}));
