import { getPlayerState } from "../player";
import { remapSlotIndex, reorderSlots } from "../reorder";
import { asArray, asNumber, asRecord } from "../value";
import type { InsertResult, WriteResult } from "./types";

export function clonePlayer(
  mappedJson: unknown,
): { json: unknown; player: Record<string, unknown> } | { error: string } {
  const json = structuredClone(mappedJson);
  const player = getPlayerState(json);
  if (!player) return { error: "PlayerStateData ausente neste save." };
  return { json, player };
}

export function insertAtFirstEmpty(
  mappedJson: unknown,
  arrayKey: string,
  payload: unknown,
  isEmpty: (slot: unknown) => boolean,
  emptyError: string,
): InsertResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const arr = asArray(cloned.player[arrayKey]);
  if (!arr) {
    return { ok: false, error: `${arrayKey} ausente neste save.` };
  }
  const index = arr.findIndex(isEmpty);
  if (index < 0) return { ok: false, error: emptyError };
  arr[index] = structuredClone(payload);
  return { ok: true, json: cloned.json, index };
}

export function replaceAtIndex(
  mappedJson: unknown,
  arrayKey: string,
  index: number,
  payload: unknown,
): InsertResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const arr = asArray(cloned.player[arrayKey]);
  if (!arr) {
    return { ok: false, error: `${arrayKey} ausente neste save.` };
  }
  if (!Number.isInteger(index) || index < 0 || index >= arr.length) {
    return { ok: false, error: "Índice de slot fora do array." };
  }
  arr[index] = structuredClone(payload);
  return { ok: true, json: cloned.json, index };
}

export function reorderPlayerArray(
  mappedJson: unknown,
  arrayKey: string,
  from: number,
  to: number,
  parallelKeys: readonly string[] = [],
  indexKeys: readonly string[] = [],
): WriteResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const arr = asArray(cloned.player[arrayKey]);
  if (!arr) {
    return { ok: false, error: `${arrayKey} ausente neste save.` };
  }
  try {
    cloned.player[arrayKey] = reorderSlots(arr, from, to);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não foi possível reordenar.",
    };
  }
  const length = arr.length;
  for (const key of parallelKeys) {
    const parallel = asArray(cloned.player[key]);
    if (parallel && parallel.length === length) {
      cloned.player[key] = reorderSlots(parallel, from, to);
    }
  }
  for (const key of indexKeys) {
    const current = asNumber(cloned.player[key]);
    if (current == null) continue;
    if (current < 0 || current >= length) continue;
    cloned.player[key] = remapSlotIndex(current, from, to);
  }
  return { ok: true, json: cloned.json };
}

export function inventoryClass(container: unknown): string {
  const rec = asRecord(container);
  const cls = asRecord(rec?.Class);
  return typeof cls?.InventoryClass === "string" ? cls.InventoryClass : "";
}
