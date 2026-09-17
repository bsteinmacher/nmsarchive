import type { Category } from "@/types/nms";
import { getPlayerState } from "../player";
import { asArray, asNumber, asRecord, asString } from "../value";
import {
  clonePlayer,
  insertAtFirstEmpty,
  replaceAtIndex,
} from "./array";
import { nestedEnum } from "./names";
import type { CategoryAdapter, ExtractedSlot, InsertResult } from "./types";

export const FREIGHTER_BASE_TYPE = "FreighterBase";
export const FREIGHTER_BASE_LABEL = "Cargueira";
export const DEEP_SPACE_BASE_TYPE = "PlayerSpaceBase";
export const DEEP_SPACE_LABEL = "Deep Space";
export const SPACE_STATION_BASE_TYPE = "PlayerSpaceStationBase";
export const SPACE_STATION_LABEL = "Space Station";
export const SPACE_STATION_BASE_LIMIT = 20;

const BASE_TYPE_LABELS: Record<string, string> = {
  HomePlanetBase: "Planeta",
  PlayerShipBase: "Nave",
  [FREIGHTER_BASE_TYPE]: FREIGHTER_BASE_LABEL,
  [DEEP_SPACE_BASE_TYPE]: DEEP_SPACE_LABEL,
  [SPACE_STATION_BASE_TYPE]: SPACE_STATION_LABEL,
};

const BASE_COLUMNS = [
  { id: "itemType", header: "Tipo" },
  { id: "objects", header: "Objetos" },
  { id: "seed", header: "Seed" },
] as const;

const EMPTY_BASE =
  "Não há slot vazio de base. O arquivo não expande PersistentPlayerBases.";

const MISSING_BASES =
  "Este save não tem PersistentPlayerBases. A categoria fica indisponível.";

export function basePersistentType(slot: unknown): string {
  return nestedEnum(asRecord(slot)?.BaseType, "PersistentBaseTypes");
}

export function isFreighterBaseSlot(item: {
  extra: Record<string, string>;
}): boolean {
  return item.extra.baseType === FREIGHTER_BASE_TYPE;
}

export function isDeepSpaceBaseSlot(item: {
  extra: Record<string, string>;
}): boolean {
  return item.extra.baseType === DEEP_SPACE_BASE_TYPE;
}

export function isSpaceStationBaseSlot(item: {
  extra: Record<string, string>;
}): boolean {
  return item.extra.baseType === SPACE_STATION_BASE_TYPE;
}

export function isHiddenFromBasesMenu(item: {
  extra: Record<string, string>;
}): boolean {
  return (
    isFreighterBaseSlot(item) ||
    isDeepSpaceBaseSlot(item) ||
    isSpaceStationBaseSlot(item)
  );
}

export function isEmptyBaseSlot(slot: unknown): boolean {
  const rec = asRecord(slot);
  const name = asString(rec?.Name)?.trim();
  const objects = asArray(rec?.Objects) ?? [];
  return !name && objects.length === 0;
}

export function baseSeedFromPayload(payload: unknown): string {
  const rec = asRecord(payload);
  const address = asNumber(rec?.GalacticAddress);
  if (address != null && address !== 0) {
    return "0x" + Math.trunc(address).toString(16);
  }
  const user = asNumber(rec?.UserData);
  if (user != null) return "0x" + Math.trunc(user).toString(16);
  return "0x0";
}

function slotCategory(typeKey: string): Category {
  if (typeKey === DEEP_SPACE_BASE_TYPE) return "deepspace";
  if (typeKey === SPACE_STATION_BASE_TYPE) return "spacestation";
  return "base";
}

function slotLabelForType(
  typeKey: string,
  n: number,
  total: number,
): string | undefined {
  if (typeKey === FREIGHTER_BASE_TYPE) {
    return total === 1 ? "Interior" : `Interior ${n}`;
  }
  if (typeKey === DEEP_SPACE_BASE_TYPE || typeKey === SPACE_STATION_BASE_TYPE) {
    return String(n);
  }
  return undefined;
}

function fallbackName(typeKey: string, index: number, itemType: string): string {
  if (typeKey === DEEP_SPACE_BASE_TYPE) return DEEP_SPACE_LABEL;
  if (typeKey === SPACE_STATION_BASE_TYPE) return SPACE_STATION_LABEL;
  return itemType ? `Base ${itemType}` : `Base ${index + 1}`;
}

export function listPersistentBases(json: unknown): ExtractedSlot[] {
  const player = getPlayerState(json);
  const bases = player?.PersistentPlayerBases;
  if (!Array.isArray(bases)) return [];

  const typeTotals: Record<string, number> = {};
  for (const slot of bases) {
    const typeKey = basePersistentType(slot);
    if (!typeKey) continue;
    typeTotals[typeKey] = (typeTotals[typeKey] ?? 0) + 1;
  }
  const typeN: Record<string, number> = {};

  return bases.map((slot, index): ExtractedSlot => {
    const rec = asRecord(slot) ?? {};
    const objects = asArray(rec.Objects) ?? [];
    const typeKey = basePersistentType(slot);
    const itemType = BASE_TYPE_LABELS[typeKey] ?? typeKey;
    const empty = isEmptyBaseSlot(slot);
    const rawName = asString(rec.Name)?.trim();
    const name = empty
      ? `Slot ${index + 1} vazio`
      : rawName && rawName !== "Default"
        ? rawName
        : fallbackName(typeKey, index, itemType);
    const warning =
      objects.length >= 50
        ? `O .nmsitem desta base é grande (${objects.length} objetos).`
        : undefined;
    if (typeKey) typeN[typeKey] = (typeN[typeKey] ?? 0) + 1;
    return {
      category: slotCategory(typeKey),
      index,
      name,
      seed: empty ? "" : baseSeedFromPayload(rec),
      className: "",
      itemType: empty ? "" : itemType,
      filename: "",
      empty,
      warning,
      slotLabel: typeKey
        ? slotLabelForType(typeKey, typeN[typeKey] ?? 0, typeTotals[typeKey] ?? 0)
        : undefined,
      extra: {
        ...(typeKey ? { baseType: typeKey } : {}),
        ...(empty ? {} : { itemType, objects: String(objects.length) }),
      },
      payload: rec,
    };
  });
}

export function listBases(json: unknown): ExtractedSlot[] {
  return listPersistentBases(json).filter(
    (item) => !isDeepSpaceBaseSlot(item) && !isSpaceStationBaseSlot(item),
  );
}

export function listFreighterBases(json: unknown): ExtractedSlot[] {
  return listPersistentBases(json).filter(isFreighterBaseSlot);
}

export function listDeepSpaceBases(json: unknown): ExtractedSlot[] {
  return listPersistentBases(json).filter(isDeepSpaceBaseSlot);
}

export function listSpaceStationBases(json: unknown): ExtractedSlot[] {
  return listPersistentBases(json).filter(isSpaceStationBaseSlot);
}

function summarizeFromList(
  list: (json: unknown) => ExtractedSlot[],
  payload: unknown,
  fallbackName: string,
) {
  const listed = list({
    BaseContext: {
      PlayerStateData: { PersistentPlayerBases: [payload] },
    },
  })[0];
  return {
    name: listed?.empty ? fallbackName : (listed?.name ?? fallbackName),
    seed: listed?.seed || baseSeedFromPayload(payload),
    extra: listed?.extra ?? {},
  };
}

function insertBaseOfType(
  mappedJson: unknown,
  payload: unknown,
  type: string,
  limit?: number,
): InsertResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const arr = asArray(cloned.player.PersistentPlayerBases);
  if (!arr) {
    return { ok: false, error: "PersistentPlayerBases ausente neste save." };
  }
  const payloadType = basePersistentType(payload);
  if (payloadType !== type) {
    const label = BASE_TYPE_LABELS[type] ?? type;
    return {
      ok: false,
      error: `Este item não é uma base ${label}.`,
    };
  }
  const filled = arr.filter(
    (slot) =>
      basePersistentType(slot) === type && !isEmptyBaseSlot(slot),
  ).length;
  if (limit != null && filled >= limit) {
    return {
      ok: false,
      error: `Este save já tem ${limit} Space Stations. Remova uma no jogo ou substitua um slot existente antes de aplicar outra.`,
    };
  }
  const emptyIndex = arr.findIndex(
    (slot) =>
      basePersistentType(slot) === type && isEmptyBaseSlot(slot),
  );
  if (emptyIndex >= 0) {
    arr[emptyIndex] = structuredClone(payload);
    return { ok: true, json: cloned.json, index: emptyIndex };
  }
  arr.push(structuredClone(payload));
  return { ok: true, json: cloned.json, index: arr.length - 1 };
}

function isPlanetLikeEmpty(slot: unknown): boolean {
  if (!isEmptyBaseSlot(slot)) return false;
  const type = basePersistentType(slot);
  return (
    type !== FREIGHTER_BASE_TYPE &&
    type !== DEEP_SPACE_BASE_TYPE &&
    type !== SPACE_STATION_BASE_TYPE
  );
}

export function resolveInsertCategory(
  category: Category,
  payload: unknown,
): Category {
  const type = basePersistentType(payload);
  if (type === DEEP_SPACE_BASE_TYPE) return "deepspace";
  if (type === SPACE_STATION_BASE_TYPE) return "spacestation";
  return category;
}

export const basesAdapter: CategoryAdapter = {
  category: "base",
  label: "Bases",
  columns: BASE_COLUMNS,
  list: listBases,
  insert: (json, payload) =>
    insertAtFirstEmpty(
      json,
      "PersistentPlayerBases",
      payload,
      isPlanetLikeEmpty,
      EMPTY_BASE,
    ),
  replace: (json, index, payload) =>
    replaceAtIndex(json, "PersistentPlayerBases", index, payload),
  summarize: (payload) => summarizeFromList(listBases, payload, "Base"),
  seedFromPayload: baseSeedFromPayload,
  missingMessage: MISSING_BASES,
};

export const deepSpaceAdapter: CategoryAdapter = {
  category: "deepspace",
  label: DEEP_SPACE_LABEL,
  columns: BASE_COLUMNS,
  list: listDeepSpaceBases,
  insert: (json, payload) =>
    insertBaseOfType(json, payload, DEEP_SPACE_BASE_TYPE),
  replace: (json, index, payload) =>
    replaceAtIndex(json, "PersistentPlayerBases", index, payload),
  summarize: (payload) =>
    summarizeFromList(listDeepSpaceBases, payload, DEEP_SPACE_LABEL),
  seedFromPayload: baseSeedFromPayload,
  missingMessage: MISSING_BASES,
};

export const spaceStationAdapter: CategoryAdapter = {
  category: "spacestation",
  label: SPACE_STATION_LABEL,
  columns: BASE_COLUMNS,
  list: listSpaceStationBases,
  insert: (json, payload) =>
    insertBaseOfType(
      json,
      payload,
      SPACE_STATION_BASE_TYPE,
      SPACE_STATION_BASE_LIMIT,
    ),
  replace: (json, index, payload) =>
    replaceAtIndex(json, "PersistentPlayerBases", index, payload),
  summarize: (payload) =>
    summarizeFromList(listSpaceStationBases, payload, SPACE_STATION_LABEL),
  seedFromPayload: baseSeedFromPayload,
  missingMessage: MISSING_BASES,
};
