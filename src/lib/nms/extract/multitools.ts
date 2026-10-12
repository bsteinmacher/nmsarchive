import { getPlayerState, type SaveContext } from "../player";
import { multitoolTypeFromFilename } from "../multitool-type";
import {
  asArray,
  asRecord,
  asString,
  nameFromFilename,
  normalizeSeed,
} from "../value";
import { mergeApply, MULTITOOL_MERGE, type ApplyDepth } from "./apply-depth";
import {
  insertAtFirstEmpty,
  emptySlotAt,
  inventoryClass,
  reorderPlayerArray,
  replaceAtIndex,
  clonePlayer,
} from "./array";
import { emptySlotLabel } from "./names";
import type { CategoryAdapter, ExtractedSlot, InsertResult } from "./types";

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

export function listMultitools(
  json: unknown,
  context: SaveContext = "main",
): ExtractedSlot[] {
  const player = getPlayerState(json, context);
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

export function applyMultitool(
  mappedJson: unknown,
  index: number,
  payload: unknown,
  depth: ApplyDepth = "full",
  context: SaveContext = "main",
): InsertResult {
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const tools = asArray(cloned.player.Multitools);
  if (!tools) {
    return { ok: false, error: "Multitools ausente neste save." };
  }
  if (!Number.isInteger(index) || index < 0 || index >= tools.length) {
    return { ok: false, error: "Índice de slot fora do array." };
  }
  const source = asRecord(payload);
  if (!source) return { ok: false, error: "Payload de multi-tool inválido." };
  const empty = isEmptyMultitoolSlot(tools[index]);
  tools[index] =
    empty && depth === "full"
      ? structuredClone(source)
      : mergeApply(tools[index], source, depth, MULTITOOL_MERGE);
  return { ok: true, index, json: cloned.json };
}

export const multitoolsAdapter: CategoryAdapter = {
  category: "multitool",
  label: "Multi Tools",
  columns: [
    { id: "className", header: "Class" },
    { id: "itemType", header: "Type" },
    { id: "seed", header: "Seed" },
  ],
  list: listMultitools,
  insert: (json, payload, context) =>
    insertAtFirstEmpty(
      json,
      "Multitools",
      payload,
      isEmptyMultitoolSlot,
      EMPTY_MT,
      context,
    ),
  replace: (json, index, payload, context) =>
    replaceAtIndex(json, "Multitools", index, payload, context),
  clear: (json, index, context) =>
    emptySlotAt(
      json,
      "Multitools",
      index,
      isEmptyMultitoolSlot,
      {
        Name: "",
        Resource: { Filename: "", Seed: [false, "0x0"] },
        Seed: [false, "0x0"],
      },
      context,
    ),
  reorder: (json, from, to, context) =>
    reorderPlayerArray(json, "Multitools", from, to, [], [
      "ActiveMultioolIndex",
    ], context),
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
