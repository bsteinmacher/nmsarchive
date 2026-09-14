import { isEmptyShipSlot } from "./extract/ships";
import { getPlayerState } from "./player";
import { writeHg } from "./parse";
import type { MappingFile } from "./mapping";

export type InsertResult =
  | { ok: true; index: number; json: unknown }
  | { ok: false; error: string };

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

export function encodeMappedSave(
  mappedJson: unknown,
  mapping: MappingFile,
): Uint8Array {
  return writeHg(mappedJson, mapping);
}
