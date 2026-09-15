import { getPlayerState } from "../player";
import { shipTypeFromFilename } from "../ship-type";
import {
  asRecord,
  asString,
  nameFromFilename,
  normalizeSeed,
} from "../value";
import type { ExtractedShip } from "./types";

export function isEmptyShipSlot(slot: unknown): boolean {
  const rec = asRecord(slot);
  const resource = asRecord(rec?.Resource);
  const filename = asString(resource?.Filename);
  return !filename;
}

export function emptySlotLabel(index: number): string {
  return `Slot ${index + 1} vazio`;
}

export function listShips(json: unknown): ExtractedShip[] {
  const player = getPlayerState(json);
  const ships = player?.ShipOwnership;
  if (!Array.isArray(ships)) return [];

  return ships.map((slot, index): ExtractedShip => {
    const rec = asRecord(slot) ?? {};
    if (isEmptyShipSlot(slot)) {
      return {
        category: "ship" as const,
        index,
        name: emptySlotLabel(index),
        seed: "",
        className: "",
        filename: "",
        shipType: "",
        empty: true,
        extra: {},
        payload: rec,
      };
    }
    const resource = asRecord(rec.Resource) ?? {};
    const filename = asString(resource.Filename) ?? "";
    const inventory = asRecord(rec.Inventory) ?? {};
    const cls = asRecord(inventory.Class) ?? {};
    const className = asString(cls.InventoryClass) ?? "?";
    const rawName = asString(rec.Name) ?? "";
    const name = rawName || nameFromFilename(filename);
    const seed = normalizeSeed(resource.Seed);
    const shipType = shipTypeFromFilename(filename);
    return {
      category: "ship" as const,
      index,
      name,
      seed,
      className,
      filename,
      shipType,
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
