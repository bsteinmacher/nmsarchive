import { getPlayerState } from "../player";
import { remapSlotIndex, reorderSlots } from "../reorder";
import { shipTypeFromFilename } from "../ship-type";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  nameFromFilename,
  normalizeSeed,
} from "../value";
import { inventoryClass } from "./array";
import { emptySlotLabel } from "./names";
import type {
  CategoryAdapter,
  ExtractedShip,
  InsertResult,
  WriteResult,
} from "./types";

export function isEmptyShipSlot(slot: unknown): boolean {
  const rec = asRecord(slot);
  const resource = asRecord(rec?.Resource);
  const filename = asString(resource?.Filename);
  return !filename;
}

export { emptySlotLabel } from "./names";

export function listShips(json: unknown): ExtractedShip[] {
  const player = getPlayerState(json);
  const ships = player?.ShipOwnership;
  if (!Array.isArray(ships)) return [];

  return ships.map((slot, index): ExtractedShip => {
    const rec = asRecord(slot) ?? {};
    if (isEmptyShipSlot(slot)) {
      return {
        category: "ship",
        index,
        name: emptySlotLabel(index),
        seed: "",
        className: "",
        filename: "",
        shipType: "",
        itemType: "",
        empty: true,
        extra: {},
        payload: rec,
      };
    }
    const resource = asRecord(rec.Resource) ?? {};
    const filename = asString(resource.Filename) ?? "";
    const className = inventoryClass(rec.Inventory);
    const rawName = asString(rec.Name) ?? "";
    const name = rawName || nameFromFilename(filename);
    const seed = normalizeSeed(resource.Seed);
    const shipType = shipTypeFromFilename(filename);
    return {
      category: "ship",
      index,
      name,
      seed,
      className,
      filename,
      shipType,
      itemType: shipType,
      empty: false,
      extra: { class: className, filename, shipType },
      payload: rec,
    };
  });
}

export function listFilledShips(json: unknown): ExtractedShip[] {
  return listShips(json).filter((ship) => !ship.empty);
}

export function shipSeedFromPayload(payload: unknown): string {
  const rec = asRecord(payload);
  const resource = asRecord(rec?.Resource);
  return normalizeSeed(resource?.Seed);
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
        "Não há slot vazio de nave. O jogo limita o array; o arquivo não expande ShipOwnership.",
    };
  }
  player.ShipOwnership[index] = structuredClone(payload);
  return { ok: true, index, json };
}

export function replaceShip(
  mappedJson: unknown,
  index: number,
  payload: unknown,
): InsertResult {
  const json = structuredClone(mappedJson);
  const player = getPlayerState(json);
  if (!player) {
    return { ok: false, error: "PlayerStateData ausente neste save." };
  }
  const ships = asArray(player.ShipOwnership);
  if (!ships) {
    return { ok: false, error: "ShipOwnership ausente neste save." };
  }
  if (!Number.isInteger(index) || index < 0 || index >= ships.length) {
    return { ok: false, error: "Índice de slot fora do array." };
  }
  ships[index] = structuredClone(payload);
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

export const shipsAdapter: CategoryAdapter = {
  category: "ship",
  label: "Naves",
  columns: [
    { id: "className", header: "Classe" },
    { id: "itemType", header: "Ship Type" },
    { id: "seed", header: "Seed" },
  ],
  list: listShips,
  insert: insertShip,
  replace: replaceShip,
  reorder: reorderShipOwnership,
  summarize(payload) {
    const listed = listShips({
      BaseContext: { PlayerStateData: { ShipOwnership: [payload] } },
    })[0];
    return {
      name: listed?.empty ? "Nave" : (listed?.name ?? "Nave"),
      seed: listed?.seed || shipSeedFromPayload(payload),
      extra: listed?.extra ?? {},
    };
  },
  seedFromPayload: shipSeedFromPayload,
  missingMessage:
    "Este save não tem ShipOwnership. A categoria fica indisponível até o jogo criar os slots.",
};
