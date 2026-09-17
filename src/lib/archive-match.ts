import {
  FREIGHTER_BASE_LABEL,
  FREIGHTER_BASE_TYPE,
  isFreighterBaseSlot,
} from "@/lib/nms/extract/bases";
import type { ExtractedSlot } from "@/lib/nms/extract/types";
import { screenshotPublicUrl } from "@/lib/screenshots";
import type { ArchivedItemSummary } from "@/types/archive";

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

export function saveSlotUiCategory(item: ExtractedSlot): string {
  return isFreighterBaseSlot(item) ? "freighter" : item.category;
}

export function matchingArchivedItems(
  items: ArchivedItemSummary[],
  slot: ExtractedSlot,
): ArchivedItemSummary[] {
  const normalized = slot.seed.toLowerCase();
  if (slot.empty || slot.readonly || !normalized || normalized === "0x0") {
    return [];
  }
  const uiCategory = saveSlotUiCategory(slot);
  return items.filter(
    (item) =>
      item.seed.toLowerCase() === normalized &&
      archiveUiCategory(item) === uiCategory,
  );
}

export function archivedScreenshotUrl(
  items: ArchivedItemSummary[],
  slot: ExtractedSlot,
): string | null {
  const hit = matchingArchivedItems(items, slot).find(
    (item) => item.screenshotPath,
  );
  return screenshotPublicUrl(hit?.screenshotPath);
}

/** @deprecated use matchingItems */
export function matchingShips(
  ships: ExtractedSlot[],
  seed: string,
  category: string,
): ExtractedSlot[] {
  return matchingItems(ships, seed, category);
}
