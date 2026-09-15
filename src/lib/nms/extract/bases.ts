import { getPlayerState } from "../player";
import { asArray, asNumber, asRecord, asString } from "../value";
import { insertAtFirstEmpty, replaceAtIndex } from "./array";
import { nestedEnum } from "./names";
import type { CategoryAdapter, ExtractedSlot } from "./types";

const BASE_TYPE_LABELS: Record<string, string> = {
  HomePlanetBase: "Planeta",
  PlayerShipBase: "Nave",
  FreighterBase: "Cargueira",
};

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

  return bases.map((slot, index): ExtractedSlot => {
    const rec = asRecord(slot) ?? {};
    const objects = asArray(rec.Objects) ?? [];
    const typeKey = nestedEnum(rec.BaseType, "PersistentBaseTypes");
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
      extra: empty
        ? {}
        : { itemType, objects: String(objects.length), baseType: typeKey },
      payload: rec,
    };
  });
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
