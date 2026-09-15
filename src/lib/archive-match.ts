import {
  FREIGHTER_BASE_LABEL,
  FREIGHTER_BASE_TYPE,
} from "@/lib/nms/extract/bases";
import type { ExtractedSlot } from "@/lib/nms/extract/types";

export function isArchivedFreighterBase(item: {
  category: string;
  shipType?: string | null;
  extra?: { baseType?: string } | null;
}): boolean {
  if (item.category !== "base") return false;
  return (
    item.extra?.baseType === FREIGHTER_BASE_TYPE ||
    item.shipType === FREIGHTER_BASE_LABEL
  );
}

export function archiveUiCategory(item: {
  category: string;
  shipType?: string | null;
  extra?: { baseType?: string } | null;
}): string {
  return isArchivedFreighterBase(item) ? "freighter" : item.category;
}

export function matchingItems(
  items: ExtractedSlot[],
  seed: string,
  category: string,
): ExtractedSlot[] {
  const normalized = seed.toLowerCase();
  if (!normalized || normalized === "0x0") {
    return items.filter(
      (item) =>
        !item.empty &&
        !item.readonly &&
        item.category === category &&
        item.seed.toLowerCase() === normalized &&
        item.group !== "automatic",
    );
  }
  return items.filter(
    (item) =>
      !item.empty &&
      !item.readonly &&
      item.category === category &&
      item.seed.toLowerCase() === normalized,
  );
}

/** @deprecated use matchingItems */
export function matchingShips(
  ships: ExtractedSlot[],
  seed: string,
  category: string,
): ExtractedSlot[] {
  return matchingItems(ships, seed, category);
}
