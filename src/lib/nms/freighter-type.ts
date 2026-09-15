import { nameFromFilename } from "./value";

const FREIGHTER_TYPE_MARKERS: readonly [marker: string, label: string][] = [
  ["PIRATEFREIGHTER", "Pirate"],
  ["CAPITALFREIGHTER", "Capital"],
  ["FREIGHTERTINY", "Freighter"],
  ["FREIGHTER", "Freighter"],
];

export function freighterTypeFromFilename(filename: string): string {
  if (!filename) return "";
  const upper = filename.toUpperCase();
  for (const [marker, label] of FREIGHTER_TYPE_MARKERS) {
    if (upper.includes(marker)) return label;
  }
  return nameFromFilename(filename);
}

const FRIGATE_CLASS_LABELS: Record<string, string> = {
  Combat: "Combat",
  Exploration: "Exploration",
  Mining: "Mining",
  Diplomacy: "Diplomacy",
  Support: "Support",
  Normandy: "Normandy",
  DeepSpace: "Leviathan",
  DeepSpaceCommon: "Organic",
  Pirate: "Pirate",
  GhostShip: "Ghost",
};

export function frigateClassLabel(value: string): string {
  return FRIGATE_CLASS_LABELS[value] ?? value;
}
