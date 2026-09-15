import { isEmptyShipSlot } from "./extract/ships";
import { getPlayerState } from "./player";
import { remapSlotIndex, reorderSlots } from "./reorder";
import { asArray, asNumber } from "./value";
import { writeHg } from "./parse";
import type { MappingFile } from "./mapping";

export type WriteResult =
  | { ok: true; json: unknown }
  | { ok: false; error: string };

export type InsertResult =
  | { ok: true; json: unknown; index: number }
  | { ok: false; error: string };

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

export function insertShip(mappedJson: unknown, payload: unknown): InsertResult {
  const json = structuredClone(mappedJson);
  const player = getPlayerState(json);
  if (!player) {
    return { ok: false, error: "PlayerStateData ausente neste save." };
  }
  if (!Array.isArray(player.ShipOwnership)) {
    return { ok: false, error: "ShipOwnership ausente neste save." };
  }
  const index = player.ShipOwnership.findIndex(isEmptyShipSlot);
  if (index < 0) {
    return {
      ok: false,
      error:
        "Não há slot vazio de nave. O jogo limita o array; o MVP não expande ShipOwnership.",
    };
  }
  player.ShipOwnership[index] = structuredClone(payload);
  return { ok: true, index, json };
}

const SHIP_INDEX_KEYS = ["PrimaryShip", "CorvetteEditAssociatedShipIndex"] as const;

export function reorderShipOwnership(
  mappedJson: unknown,
  from: number,
  to: number,
): WriteResult {
  const json = structuredClone(mappedJson);
  const player = getPlayerState(json);
  if (!player) {
    return { ok: false, error: "PlayerStateData ausente neste save." };
  }
  const ships = asArray(player.ShipOwnership);
  if (!ships) {
    return { ok: false, error: "ShipOwnership ausente neste save." };
  }
  try {
    player.ShipOwnership = reorderSlots(ships, from, to);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não foi possível reordenar.",
    };
  }
  const length = ships.length;
  const legacy = asArray(player.ShipUsesLegacyColours);
  if (legacy && legacy.length === length) {
    player.ShipUsesLegacyColours = reorderSlots(legacy, from, to);
  }
  for (const key of SHIP_INDEX_KEYS) {
    const current = asNumber(player[key]);
    if (current == null) continue;
    if (current < 0 || current >= length) continue;
    player[key] = remapSlotIndex(current, from, to);
  }
  return { ok: true, json };
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
