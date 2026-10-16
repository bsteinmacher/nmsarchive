import { nameFromFilename } from "./value";

/** Tipos da wiki: Pistol, Rifle, Experimental, Alien, Exotic/Royal, Sentinel, Atlantid, Voltaic Staff. */
export const MULTITOOL_TYPES = [
  "Pistol",
  "Rifle",
  "Experimental",
  "Alien",
  "Exotic / Royal",
  "Sentinel",
  "Atlantid",
  "Voltaic Staff",
] as const;

export type MultitoolType = (typeof MULTITOOL_TYPES)[number];

const MULTITOOL_TYPE_SET = new Set<string>(MULTITOOL_TYPES);

/** Labels antigos ou do filename que equivalem a um tipo da wiki. */
const TYPE_ALIASES: Record<string, MultitoolType> = {
  Pistol: "Pistol",
  Rifle: "Rifle",
  Experimental: "Experimental",
  Alien: "Alien",
  Royal: "Exotic / Royal",
  "Exotic / Royal": "Exotic / Royal",
  Sentinel: "Sentinel",
  Atlantid: "Atlantid",
  Staff: "Voltaic Staff",
  "Atlas Staff": "Voltaic Staff",
  "Voltaic Staff": "Voltaic Staff",
};

/** Marcadores mais específicos primeiro (STAFFMULTITOOLATLAS contém STAFF). */
const MULTITOOL_TYPE_MARKERS: readonly [marker: string, label: string][] = [
  ["STAFFMULTITOOLATLAS", "Voltaic Staff"],
  ["ATLASMULTITOOL", "Atlas"],
  ["STAFFMULTITOOL", "Voltaic Staff"],
  ["ROYALMULTITOOL", "Exotic / Royal"],
  ["SENTINEL", "Sentinel"],
  ["ROBOT", "Sentinel"],
  ["ATLANTID", "Atlantid"],
  ["ATLANTEAN", "Atlantid"],
  ["FISHING", "Fishing"],
  ["MULTITOOL", "Multi-tool"],
];

export function isMultitoolType(label: string): label is MultitoolType {
  return MULTITOOL_TYPE_SET.has(label);
}

/** Staff → Voltaic Staff, Royal → Exotic / Royal. Multi-tool genérico fica vazio. */
export function normalizeMultitoolType(label: string): string {
  const trimmed = label.trim();
  if (!trimmed || trimmed === "Multi-tool") return "";
  return TYPE_ALIASES[trimmed] ?? "";
}

/** Valor do dropdown: tipo da wiki, ou o label detectado se não for genérico. */
export function archiveMultitoolType(label: string): string {
  return normalizeMultitoolType(label) || (label === "Multi-tool" ? "" : label.trim());
}

export function multitoolTypeFromFilename(filename: string): string {
  if (!filename) return "";
  const upper = filename.toUpperCase();
  for (const [marker, label] of MULTITOOL_TYPE_MARKERS) {
    if (upper.includes(marker)) return label;
  }
  return nameFromFilename(filename);
}
