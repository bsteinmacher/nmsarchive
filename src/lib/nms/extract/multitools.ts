import { getPlayerState } from "../player";
import { multitoolTypeFromFilename } from "../multitool-type";
import {
  asRecord,
  asString,
  nameFromFilename,
  normalizeSeed,
} from "../value";
import {
  insertAtFirstEmpty,
  emptySlotAt,
  inventoryClass,
  reorderPlayerArray,
  replaceAtIndex,
} from "./array";
import { emptySlotLabel } from "./names";
import type { CategoryAdapter, ExtractedSlot } from "./types";

export function isEmptyMultitoolSlot(slot: unknown): boolean {
  const rec = asRecord(slot);
  const resource = asRecord(rec?.Resource);
  return !asString(resource?.Filename);
}

export function multitoolSeedFromPayload(payload: unknown): string {
  const rec = asRecord(payload);
  const fromField = normalizeSeed(rec?.Seed);
  if (fromField !== "0x0") return fromField;
  const resource = asRecord(rec?.Resource);
  return normalizeSeed(resource?.Seed);
}

export function listMultitools(json: unknown): ExtractedSlot[] {
  const player = getPlayerState(json);
  const tools = player?.Multitools;
  if (!Array.isArray(tools)) return [];

  return tools.map((slot, index): ExtractedSlot => {
    const rec = asRecord(slot) ?? {};
    if (isEmptyMultitoolSlot(slot)) {
      return {
        category: "multitool",
        index,
        name: emptySlotLabel(index),
        seed: "",
        className: "",
        itemType: "",
        filename: "",
        empty: true,
        extra: {},
        payload: rec,
      };
    }
    const resource = asRecord(rec.Resource) ?? {};
    const filename = asString(resource.Filename) ?? "";
    const className = inventoryClass(rec.Store);
    const itemType = multitoolTypeFromFilename(filename);
    const rawName = asString(rec.Name) ?? "";
    const name = rawName || nameFromFilename(filename);
    const seed = multitoolSeedFromPayload(rec);
    return {
      category: "multitool",
      index,
      name,
      seed,
      className,
      itemType,
      filename,
      empty: false,
      extra: { class: className, filename, itemType },
      payload: rec,
    };
  });
}

const EMPTY_MT =
  "Não há slot vazio de multi-tool. O jogo limita o array; o arquivo não expande Multitools.";

export const multitoolsAdapter: CategoryAdapter = {
  category: "multitool",
  label: "Multi Tools",
  columns: [
    { id: "className", header: "Class" },
    { id: "itemType", header: "Type" },
    { id: "seed", header: "Seed" },
  ],
  list: listMultitools,
  insert: (json, payload) =>
    insertAtFirstEmpty(
      json,
      "Multitools",
      payload,
      isEmptyMultitoolSlot,
      EMPTY_MT,
    ),
  replace: (json, index, payload) =>
    replaceAtIndex(json, "Multitools", index, payload),
  clear: (json, index) =>
    emptySlotAt(json, "Multitools", index, isEmptyMultitoolSlot, {
      Name: "",
      Resource: { Filename: "", Seed: [false, "0x0"] },
      Seed: [false, "0x0"],
    }),
  reorder: (json, from, to) =>
    reorderPlayerArray(json, "Multitools", from, to, [], [
      "ActiveMultioolIndex",
    ]),
  summarize(payload) {
    const listed = listMultitools({
      BaseContext: { PlayerStateData: { Multitools: [payload] } },
    })[0];
    return {
      name: listed?.empty ? "Multi-tool" : (listed?.name ?? "Multi-tool"),
      seed: listed?.seed || multitoolSeedFromPayload(payload),
      extra: listed?.extra ?? {},
    };
  },
  seedFromPayload: multitoolSeedFromPayload,
  missingMessage:
    "Este save não tem Multitools. WeaponOwnership não existe neste formato.",
};
