import { getPlayerState, type SaveContext } from "../player";
import { shipTypeFromFilename } from "../ship-type";
import {
  asArray,
  asRecord,
  asString,
  nameFromFilename,
  normalizeSeed,
} from "../value";
import { displayId, nestedEnum } from "./names";
import type { ExtractedSlot } from "./types";

function resourceFilename(resource: unknown): string {
  return asString(asRecord(resource)?.Filename) ?? "";
}

export function listSquadronPilots(
  json: unknown,
  context: SaveContext = "main",
): ExtractedSlot[] {
  const player = getPlayerState(json, context);
  const pilots = asArray(player?.SquadronPilots);
  if (!pilots?.length) return [];

  const items: ExtractedSlot[] = [];
  pilots.forEach((slot, index) => {
    const rec = asRecord(slot) ?? {};
    const filename = resourceFilename(rec.ShipResource);
    const empty = !filename;
    if (empty) return;
    const rank = nestedEnum(rec.PilotRank, "PilotRank") || displayId(rec.PilotRank);
    const itemType = shipTypeFromFilename(filename);
    const seed = normalizeSeed(asRecord(rec.ShipResource)?.Seed);
    items.push({
      category: "ship",
      index,
      name: nameFromFilename(filename) || `Pilot ${index + 1}`,
      seed,
      className: rank,
      itemType,
      filename,
      empty: false,
      readonly: true,
      group: "squadron",
      slotLabel: String(index + 1),
      extra: {
        ...(rank ? { rank } : {}),
        ...(itemType ? { itemType } : {}),
      },
      payload: rec,
    });
  });
  return items;
}
