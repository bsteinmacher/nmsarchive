import {
  insertItem,
  applyItem,
  reorderCategory,
  reorderShipOwnership,
  insertShip,
  clearItem,
  type InsertResult,
} from "./extract";
import { getPlayerState, missingPlayerMessage, type SaveContext } from "./player";
import type { MappingFile } from "./mapping";
import { writeHg } from "./parse";
import type { Category } from "@/types/nms";
import type { ApplyRequest } from "./extract/apply-depth";

export type WriteResult =
  | { ok: true; json: unknown }
  | { ok: false; error: string };

export type { InsertResult };

/** Teto das Units no jogo (uint32): ~o dobro de 2.147.483.647. */
export const UNITS_MIN = 0;
export const UNITS_MAX = 4_294_967_295;

export type PlayerCurrencies = {
  units: number;
  nanites: number;
  specials: number;
};

export function unitsOutsideRange(units: number): boolean {
  return units < UNITS_MIN || units > UNITS_MAX;
}

export { insertShip, reorderShipOwnership };

export function insertCategoryItem(
  mappedJson: unknown,
  category: Category,
  payload: unknown,
  seed?: string,
  context: SaveContext = "main",
): InsertResult {
  return insertItem(mappedJson, category, payload, seed, context);
}

export function applyCategoryItem(
  mappedJson: unknown,
  category: Category,
  payload: unknown,
  seed?: string,
  context: SaveContext = "main",
  request?: ApplyRequest,
): InsertResult {
  return applyItem(mappedJson, category, payload, seed, context, request);
}

export function clearCategorySlot(
  mappedJson: unknown,
  category: Category,
  index: number,
  context: SaveContext = "main",
): InsertResult {
  return clearItem(mappedJson, category, index, context);
}

export function reorderCategorySlots(
  mappedJson: unknown,
  category: Category,
  from: number,
  to: number,
  context: SaveContext = "main",
): WriteResult {
  return reorderCategory(mappedJson, category, from, to, context);
}

export function setPlayerCurrencies(
  mappedJson: unknown,
  coins: Partial<PlayerCurrencies>,
  context: SaveContext = "main",
): WriteResult {
  const json = structuredClone(mappedJson);
  const player = getPlayerState(json, context);
  if (!player) {
    return { ok: false, error: missingPlayerMessage(context) };
  }
  if (coins.units != null) player.Units = coins.units;
  if (coins.nanites != null) player.Nanites = coins.nanites;
  if (coins.specials != null) player.Specials = coins.specials;
  return { ok: true, json };
}

export function encodeMappedSave(
  mappedJson: unknown,
  mapping: MappingFile,
): Uint8Array {
  return writeHg(mappedJson, mapping);
}
