import { frigateClassLabel } from "../freighter-type";
import { getPlayerState } from "../player";
import { asArray, asRecord, asString, normalizeSeed } from "../value";
import { insertAtFirstEmpty, replaceAtIndex } from "./array";
import { nestedEnum } from "./names";
import type { CategoryAdapter, ExtractedSlot } from "./types";

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

export function listFrigates(json: unknown): ExtractedSlot[] {
  const player = getPlayerState(json);
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
    const itemType = frigateClassLabel(
      nestedEnum(rec.FrigateClass, "FrigateClass"),
    );
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
        traits: String(traits.length),
      },
      payload: rec,
    };
  });
}

const EMPTY_FRIGATE =
  "Não há slot vazio de fragata. O arquivo não expande FleetFrigates.";

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
  insert: (json, payload) =>
    insertAtFirstEmpty(
      json,
      "FleetFrigates",
      payload,
      isEmptyFrigateSlot,
      EMPTY_FRIGATE,
    ),
  replace: (json, index, payload) =>
    replaceAtIndex(json, "FleetFrigates", index, payload),
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
