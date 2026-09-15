import {
  insertItem,
  reorderCategory,
  reorderShipOwnership,
  insertShip,
  type InsertResult,
} from "./extract";
import { getPlayerState } from "./player";
import type { MappingFile } from "./mapping";
import { writeHg } from "./parse";
import type { Category } from "@/types/nms";

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
): InsertResult {
  return insertItem(mappedJson, category, payload, seed);
}

export function reorderCategorySlots(
  mappedJson: unknown,
  category: Category,
  from: number,
  to: number,
): WriteResult {
  return reorderCategory(mappedJson, category, from, to);
}

export function setPlayerCurrencies(
  mappedJson: unknown,
  coins: Partial<PlayerCurrencies>,
): WriteResult {
  const json = structuredClone(mappedJson);
  const player = getPlayerState(json);
  if (!player) {
    return { ok: false, error: "PlayerStateData ausente neste save." };
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
