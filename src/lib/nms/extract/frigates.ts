import { frigateClassLabel } from "../freighter-type";
import { getPlayerState, type SaveContext } from "../player";
import { asArray, asRecord, asString, normalizeSeed } from "../value";
import { clonePlayer, replaceAtIndex } from "./array";
import { nestedEnum } from "./names";
import type { CategoryAdapter, ExtractedSlot, InsertResult } from "./types";

/** Teto da frota no jogo. O JSON não pré-aloca 30 vazios — só as fragatas existentes. */
export const FLEET_FRIGATE_LIMIT = 30;

/** Ordem da Frigate List. Leviathan e Organic são classes diferentes. */
const FRIGATE_ROLE_ORDER = [
  "Combat",
  "Exploration",
  "Mining",
  "Diplomacy",
  "Support",
  "Normandy",
  "DeepSpace",
  "DeepSpaceCommon",
  "Pirate",
  "GhostShip",
] as const;

const INVENTORY_CLASS_ORDER = ["S", "A", "B", "C"] as const;

export type FrigateDisplayGroup = {
  role: string;
  title: string;
  items: ExtractedSlot[];
};

export function isEmptyFrigateSlot(slot: unknown): boolean {
  const rec = asRecord(slot);
  const className = nestedEnum(rec?.FrigateClass, "FrigateClass");
  const seed = normalizeSeed(rec?.ResourceSeed);
  return !className && seed === "0x0";
}

export function frigateSeedFromPayload(payload: unknown): string {
  const rec = asRecord(payload);
  return normalizeSeed(rec?.ResourceSeed);
}

export function listFrigates(
  json: unknown,
  context: SaveContext = "main",
): ExtractedSlot[] {
  const player = getPlayerState(json, context);
  const frigates = player?.FleetFrigates;
  if (!Array.isArray(frigates)) return [];

  return frigates.map((slot, index): ExtractedSlot => {
    const rec = asRecord(slot) ?? {};
    if (isEmptyFrigateSlot(slot)) {
      return {
        category: "frigate",
        index,
        name: `Slot ${index + 1} vazio`,
        seed: "",
        className: "",
        itemType: "",
        filename: "",
        empty: true,
        extra: {},
        payload: rec,
      };
    }
    const role = nestedEnum(rec.FrigateClass, "FrigateClass");
    const itemType = frigateClassLabel(role);
    const className = nestedEnum(rec.InventoryClass, "InventoryClass");
    const traits = asArray(rec.TraitIDs) ?? [];
    const custom = asString(rec.CustomName)?.trim();
    const name = custom || itemType || `Frigate ${index + 1}`;
    const seed = frigateSeedFromPayload(rec);
    return {
      category: "frigate",
      index,
      name,
      seed,
      className,
      itemType,
      filename: "",
      empty: false,
      extra: {
        class: className,
        itemType,
        role,
        traits: String(traits.length),
      },
      payload: rec,
    };
  });
}

export function insertFrigate(
  mappedJson: unknown,
  payload: unknown,
  context: SaveContext = "main",
): InsertResult {
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  let arr = asArray(cloned.player.FleetFrigates);
  if (!arr) {
    arr = [];
    cloned.player.FleetFrigates = arr;
  }
  const filled = arr.filter((slot) => !isEmptyFrigateSlot(slot)).length;
  if (filled >= FLEET_FRIGATE_LIMIT) {
    return {
      ok: false,
      error: `Este save já tem ${FLEET_FRIGATE_LIMIT} fragatas. Exclua uma no save ou no jogo antes de aplicar outra.`,
    };
  }
  const emptyIndex = arr.findIndex(isEmptyFrigateSlot);
  if (emptyIndex >= 0) {
    arr[emptyIndex] = structuredClone(payload);
    return { ok: true, json: cloned.json, index: emptyIndex };
  }
  arr.push(structuredClone(payload));
  return { ok: true, json: cloned.json, index: arr.length - 1 };
}

function rankOf(order: readonly string[], value: string): number {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

/** Ordem da tela do jogo. Não altera FleetFrigates. */
export function compareFrigateDisplay(
  a: ExtractedSlot,
  b: ExtractedSlot,
): number {
  if (a.empty !== b.empty) return a.empty ? 1 : -1;
  const role =
    rankOf(FRIGATE_ROLE_ORDER, a.extra.role ?? "") -
    rankOf(FRIGATE_ROLE_ORDER, b.extra.role ?? "");
  if (role !== 0) return role;
  const inventory =
    rankOf(INVENTORY_CLASS_ORDER, a.className) -
    rankOf(INVENTORY_CLASS_ORDER, b.className);
  if (inventory !== 0) return inventory;
  return a.name.localeCompare(b.name, "pt-BR");
}

export function groupFrigatesForDisplay(
  items: ExtractedSlot[],
): FrigateDisplayGroup[] {
  const groups: FrigateDisplayGroup[] = [];
  for (const item of [...items].sort(compareFrigateDisplay)) {
    if (item.empty) continue;
    const role = item.extra.role || "Unknown";
    const last = groups[groups.length - 1];
    if (last?.role === role) {
      last.items.push(item);
      continue;
    }
    groups.push({
      role,
      title: frigateClassLabel(role),
      items: [item],
    });
  }
  return groups;
}

export function clearFrigate(
  mappedJson: unknown,
  index: number,
  context: SaveContext = "main",
): InsertResult {
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const arr = asArray(cloned.player.FleetFrigates);
  if (!arr) {
    return { ok: false, error: "FleetFrigates ausente neste save." };
  }
  if (!Number.isInteger(index) || index < 0 || index >= arr.length) {
    return { ok: false, error: "Índice de slot fora do array." };
  }
  arr.splice(index, 1);
  return { ok: true, json: cloned.json, index };
}

export const frigatesAdapter: CategoryAdapter = {
  category: "frigate",
  label: "Frigates",
  columns: [
    { id: "className", header: "Class" },
    { id: "itemType", header: "Type" },
    { id: "traits", header: "Traits" },
    { id: "seed", header: "Seed" },
  ],
  list: listFrigates,
  insert: insertFrigate,
  replace: (json, index, payload, context) =>
    replaceAtIndex(json, "FleetFrigates", index, payload, context),
  clear: clearFrigate,
  summarize(payload) {
    const listed = listFrigates({
      BaseContext: { PlayerStateData: { FleetFrigates: [payload] } },
    })[0];
    return {
      name: listed?.empty ? "Frigate" : (listed?.name ?? "Frigate"),
      seed: listed?.seed || frigateSeedFromPayload(payload),
      extra: listed?.extra ?? {},
    };
  },
  seedFromPayload: frigateSeedFromPayload,
  missingMessage:
    "Este save não tem FleetFrigates. A categoria fica indisponível.",
};
