import { nameFromFilename } from "./value";

/** Marcadores mais específicos primeiro (FIGHTERSPECIALSWITCH contém FIGHTER). */
const SHIP_TYPE_MARKERS: readonly [marker: string, label: string][] = [
  ["FIGHTERSPECIALSWITCH", "Fighter"],
  ["SENTINELSHIP", "Interceptor"],
  ["GOLDENVECTOR", "Exotic"],
  ["BIOSHIP", "Living Ship"],
  ["DROPSHIP", "Hauler"],
  ["SAILSHIP", "Solar"],
  ["WRACER", "Solar"],
  ["SOLAR", "Solar"],
  ["BIGGS", "Exotic"],
  ["EXOTIC", "Exotic"],
  ["CORVETTE", "Corvette"],
  ["SHUTTLE", "Shuttle"],
  ["SCIENTIFIC", "Explorer"],
  ["FIGHTER", "Fighter"],
];

export function shipTypeFromFilename(filename: string): string {
  if (!filename) return "";
  const upper = filename.toUpperCase();
  for (const [marker, label] of SHIP_TYPE_MARKERS) {
    if (upper.includes(marker)) return label;
  }
  return nameFromFilename(filename);
}
