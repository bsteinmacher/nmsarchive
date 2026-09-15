import { nameFromFilename } from "./value";

/** Marcadores mais específicos primeiro (STAFFMULTITOOLATLAS contém STAFF). */
const MULTITOOL_TYPE_MARKERS: readonly [marker: string, label: string][] = [
  ["STAFFMULTITOOLATLAS", "Atlas Staff"],
  ["ATLASMULTITOOL", "Atlas"],
  ["STAFFMULTITOOL", "Staff"],
  ["ROYALMULTITOOL", "Royal"],
  ["SENTINEL", "Sentinel"],
  ["ROBOT", "Sentinel"],
  ["ATLANTID", "Atlantid"],
  ["ATLANTEAN", "Atlantid"],
  ["FISHING", "Fishing"],
  ["MULTITOOL", "Multi-tool"],
];

export function multitoolTypeFromFilename(filename: string): string {
  if (!filename) return "";
  const upper = filename.toUpperCase();
  for (const [marker, label] of MULTITOOL_TYPE_MARKERS) {
    if (upper.includes(marker)) return label;
  }
  return nameFromFilename(filename);
}
