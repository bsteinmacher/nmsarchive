"use client";

import { create } from "zustand";
import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { encodeHgClient, parseHgClient } from "@/lib/nms/client";
import { listShips, type ExtractedShip } from "@/lib/nms/extract";
import {
  parseMappingFile,
  type MappingFile,
} from "@/lib/nms/mapping";
import {
  summarizePlayer,
  type PlayerSummary,
} from "@/lib/nms/player";
import {
  insertShip,
  reorderShipOwnership,
  setPlayerCurrencies,
  type PlayerCurrencies,
} from "@/lib/nms/write";
import {
  buildNmsItem,
  type NmsItemFile,
} from "@/lib/nmsitem";

const IDB_JSON = "nmsarchive:v1:mapped-json";
const IDB_ORIGINAL = "nmsarchive:v1:original-hg";
const IDB_MAPPING = "nmsarchive:v1:mapping";
const IDB_META = "nmsarchive:v1:meta";

type SessionMeta = {
  fileName: string;
  unknownKeys: string[];
  mappingVersion: string;
};

type Status = "idle" | "hydrating" | "loading" | "ready" | "error";

type SaveSessionState = {
  status: Status;
  hydrated: boolean;
  error: string | null;
  fileName: string | null;
  mappingVersion: string | null;
  unknownKeys: string[];
  summary: PlayerSummary | null;
  ships: ExtractedShip[];
  hydrate: () => Promise<void>;
  loadFile: (file: File) => Promise<void>;
  clear: () => Promise<void>;
  importShip: (item: NmsItemFile) => Promise<number>;
  exportShip: (index: number) => NmsItemFile;
  exportAllShips: () => NmsItemFile[];
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
  return {
    status: "ready",
    error: null,
    summary: summarizePlayer(json),
    ships: listShips(json),
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

export const useSaveSession = create<SaveSessionState>((set, get) => ({
  status: "idle",
  hydrated: false,
  error: null,
  fileName: null,
  mappingVersion: null,
  unknownKeys: [],
  summary: null,
  ships: [],

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
        set(
          applyParsed(json, {
            hydrated: true,
            fileName: sessionMeta.fileName,
            unknownKeys: sessionMeta.unknownKeys,
            mappingVersion: sessionMeta.mappingVersion,
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
      mappedJson = parsed.json;
      originalBytes = bytes;
      mappingFile = mapping;
      const meta: SessionMeta = {
        fileName: file.name,
        unknownKeys: parsed.unknownKeys,
        mappingVersion: parsed.mappingVersion,
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
      unknownKeys: [],
      summary: null,
      ships: [],
    });
  },

  importShip: async (item) => {
    if (mappedJson == null || !mappingFile) {
      throw new Error("Nenhum save aberto.");
    }
    if (item.category !== "ship") {
      throw new Error("Só naves podem ser importadas na Fase 1.");
    }
    const result = insertShip(mappedJson, item.payload);
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await idbSet(IDB_JSON, mappedJson);
    set(applyParsed(mappedJson, {}));
    return result.index;
  },

  exportShip: (index) => {
    const { ships, summary } = get();
    const ship = ships.find((s) => s.index === index);
    if (!ship || ship.empty || !summary) throw new Error("Nave não encontrada.");
    return buildNmsItem({
      category: "ship",
      name: ship.name,
      seed: ship.seed,
      payload: ship.payload,
      gameVersion: summary.gameVersion,
      galaxy: summary.galaxy,
    });
  },

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

  reorderShips: async (from, to) => {
    if (mappedJson == null) throw new Error("Nenhum save aberto.");
    if (from === to) return;
    const result = reorderShipOwnership(mappedJson, from, to);
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await idbSet(IDB_JSON, mappedJson);
    set(applyParsed(mappedJson, {}));
  },

  updateCurrencies: async (coins) => {
    if (mappedJson == null) throw new Error("Nenhum save aberto.");
    const result = setPlayerCurrencies(mappedJson, coins);
    if (!result.ok) throw new Error(result.error);
    mappedJson = result.json;
    await idbSet(IDB_JSON, mappedJson);
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
