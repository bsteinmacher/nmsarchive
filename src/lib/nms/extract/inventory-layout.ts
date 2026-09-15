import { asArray, asRecord, asString } from "../value";

const LAYOUT_KEYS = [
  "ValidSlotIndices",
  "SpecialSlots",
  "Class",
  "StackSizeGroup",
  "Width",
  "Height",
  "IsCool",
  "Name",
  "Version",
  "NumSlotsFromTech",
] as const;

export function inventoryType(slot: unknown): string {
  const rec = asRecord(slot);
  const type = asRecord(rec?.Type);
  return asString(type?.InventoryType) ?? "";
}

export function isTechSlot(slot: unknown): boolean {
  return inventoryType(slot) === "Technology";
}

export function extractLayoutGrid(
  grid: unknown,
  includeTechSlots: boolean,
): Record<string, unknown> {
  const rec = asRecord(grid) ?? {};
  const out: Record<string, unknown> = {};
  for (const key of LAYOUT_KEYS) {
    if (key in rec) out[key] = structuredClone(rec[key]);
  }
  if (includeTechSlots) {
    const slots = asArray(rec.Slots) ?? [];
    out.Slots = structuredClone(slots.filter(isTechSlot));
  }
  return out;
}

export function applyLayoutGrid(
  dest: Record<string, unknown>,
  layout: Record<string, unknown> | null,
) {
  if (!layout) return;
  for (const key of LAYOUT_KEYS) {
    if (key in layout) dest[key] = structuredClone(layout[key]);
  }
  if (Array.isArray(layout.Slots)) {
    const existing = asArray(dest.Slots) ?? [];
    const kept = existing.filter((slot) => !isTechSlot(slot));
    dest.Slots = [...kept, ...structuredClone(layout.Slots)];
  }
}

export function countValidSlots(grid: unknown): number {
  const rec = asRecord(grid);
  return asArray(rec?.ValidSlotIndices)?.length ?? 0;
}

export function countSpecialSlots(grid: unknown): number {
  const rec = asRecord(grid);
  return asArray(rec?.SpecialSlots)?.length ?? 0;
}

export function countTechSlots(grid: unknown): number {
  const rec = asRecord(grid);
  return (asArray(rec?.Slots) ?? []).filter(isTechSlot).length;
}

export function gridSizeLabel(grid: unknown): string {
  const rec = asRecord(grid);
  const width = rec?.Width;
  const height = rec?.Height;
  if (typeof width === "number" && typeof height === "number") {
    return `${width}×${height}`;
  }
  return "";
}
