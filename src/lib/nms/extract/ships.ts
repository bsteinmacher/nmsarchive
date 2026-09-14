import { getPlayerState } from "../player";
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

export function listShips(json: unknown): ExtractedShip[] {
  const player = getPlayerState(json);
  const ships = player?.ShipOwnership;
  if (!Array.isArray(ships)) return [];

  const out: ExtractedShip[] = [];
  ships.forEach((slot, index) => {
    if (isEmptyShipSlot(slot)) return;
    const rec = asRecord(slot) ?? {};
    const resource = asRecord(rec.Resource) ?? {};
    const filename = asString(resource.Filename) ?? "";
    const inventory = asRecord(rec.Inventory) ?? {};
    const cls = asRecord(inventory.Class) ?? {};
    const className = asString(cls.InventoryClass) ?? "?";
    const rawName = asString(rec.Name) ?? "";
    const name = rawName || nameFromFilename(filename);
    const seed = normalizeSeed(resource.Seed);
    out.push({
      category: "ship",
      index,
      name,
      seed,
      className,
      filename,
      extra: { class: className, filename },
      payload: rec,
    });
  });
  return out;
}

export function shipSeedFromPayload(payload: unknown): string {
  const rec = asRecord(payload);
  const resource = asRecord(rec?.Resource);
  return normalizeSeed(resource?.Seed);
}
