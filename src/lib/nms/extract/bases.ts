import { getPlayerState } from "../player";
import { asArray, asNumber, asRecord, asString } from "../value";
import { insertAtFirstEmpty, replaceAtIndex } from "./array";
import { nestedEnum } from "./names";
import type { CategoryAdapter, ExtractedSlot } from "./types";

export const FREIGHTER_BASE_TYPE = "FreighterBase";
export const FREIGHTER_BASE_LABEL = "Cargueira";

const BASE_TYPE_LABELS: Record<string, string> = {
  HomePlanetBase: "Planeta",
  PlayerShipBase: "Nave",
  [FREIGHTER_BASE_TYPE]: FREIGHTER_BASE_LABEL,
};

export function basePersistentType(slot: unknown): string {
  return nestedEnum(asRecord(slot)?.BaseType, "PersistentBaseTypes");
}

export function isFreighterBaseSlot(item: {
  extra: Record<string, string>;
}): boolean {
  return item.extra.baseType === FREIGHTER_BASE_TYPE;
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

export function listBases(json: unknown): ExtractedSlot[] {
  const player = getPlayerState(json);
  const bases = player?.PersistentPlayerBases;
  if (!Array.isArray(bases)) return [];

  const interiorTotal = bases.filter(
    (slot) => basePersistentType(slot) === FREIGHTER_BASE_TYPE,
  ).length;
  let interiorN = 0;

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
        : itemType
          ? `Base ${itemType}`
          : `Base ${index + 1}`;
    const warning =
      objects.length >= 50
        ? `O .nmsitem desta base é grande (${objects.length} objetos).`
        : undefined;
    const isInterior = typeKey === FREIGHTER_BASE_TYPE;
    if (isInterior) interiorN += 1;
    return {
      category: "base",
      index,
      name,
      seed: empty ? "" : baseSeedFromPayload(rec),
      className: "",
      itemType: empty ? "" : itemType,
      filename: "",
      empty,
      warning,
      slotLabel: isInterior
        ? interiorTotal === 1
          ? "Interior"
          : `Interior ${interiorN}`
        : undefined,
      extra: {
        ...(typeKey ? { baseType: typeKey } : {}),
        ...(empty ? {} : { itemType, objects: String(objects.length) }),
      },
      payload: rec,
    };
  });
}

export function listFreighterBases(json: unknown): ExtractedSlot[] {
  return listBases(json).filter(isFreighterBaseSlot);
}

const EMPTY_BASE =
  "Não há slot vazio de base. O arquivo não expande PersistentPlayerBases.";

export const basesAdapter: CategoryAdapter = {
  category: "base",
  label: "Bases",
  columns: [
    { id: "itemType", header: "Tipo" },
    { id: "objects", header: "Objetos" },
    { id: "seed", header: "Seed" },
  ],
  list: listBases,
  insert: (json, payload) =>
    insertAtFirstEmpty(
      json,
      "PersistentPlayerBases",
      payload,
      isEmptyBaseSlot,
      EMPTY_BASE,
    ),
  replace: (json, index, payload) =>
    replaceAtIndex(json, "PersistentPlayerBases", index, payload),
  summarize(payload) {
    const listed = listBases({
      BaseContext: {
        PlayerStateData: { PersistentPlayerBases: [payload] },
      },
    })[0];
    return {
      name: listed?.empty ? "Base" : (listed?.name ?? "Base"),
      seed: listed?.seed || baseSeedFromPayload(payload),
      extra: listed?.extra ?? {},
    };
  },
  seedFromPayload: baseSeedFromPayload,
  missingMessage:
    "Este save não tem PersistentPlayerBases. A categoria fica indisponível.",
};
