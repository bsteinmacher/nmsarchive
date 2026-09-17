import {
  DEEP_SPACE_BASE_TYPE,
  DEEP_SPACE_LABEL,
  FREIGHTER_BASE_LABEL,
  FREIGHTER_BASE_TYPE,
  SPACE_STATION_BASE_TYPE,
  SPACE_STATION_LABEL,
  isFreighterBaseSlot,
} from "@/lib/nms/extract/bases";
import type { ExtractedSlot } from "@/lib/nms/extract/types";
import { screenshotPublicUrl } from "@/lib/screenshots";
import type { ArchivedItemSummary } from "@/types/archive";
import { isCategory, type Category } from "@/types/nms";

type ArchiveCategoryHint = {
  category: string;
  shipType?: string | null;
  extra?: { baseType?: string } | null;
};

function archivedBaseType(item: ArchiveCategoryHint): string {
  return item.extra?.baseType ?? "";
}

export function isArchivedFreighterBase(item: ArchiveCategoryHint): boolean {
  if (item.category !== "base") return false;
  return (
    archivedBaseType(item) === FREIGHTER_BASE_TYPE ||
    item.shipType === FREIGHTER_BASE_LABEL
  );
}

export function isArchivedDeepSpace(item: ArchiveCategoryHint): boolean {
  if (item.category !== "base") return false;
  return (
    archivedBaseType(item) === DEEP_SPACE_BASE_TYPE ||
    item.shipType === DEEP_SPACE_BASE_TYPE ||
    item.shipType === DEEP_SPACE_LABEL
  );
}

export function isArchivedSpaceStation(item: ArchiveCategoryHint): boolean {
  if (item.category !== "base") return false;
  return (
    archivedBaseType(item) === SPACE_STATION_BASE_TYPE ||
    item.shipType === SPACE_STATION_BASE_TYPE ||
    item.shipType === SPACE_STATION_LABEL
  );
}

export function archiveUiCategory(item: ArchiveCategoryHint): string {
  if (isArchivedFreighterBase(item)) return "freighter";
  if (isArchivedDeepSpace(item)) return "deepspace";
  if (isArchivedSpaceStation(item)) return "spacestation";
  return item.category;
}

/** Envelope `.nmsitem` / SQLite: COSMOS vira deepspace|spacestation; interior de cargueira fica `base`. */
export function archiveEnvelopeCategory(item: ArchiveCategoryHint): Category | null {
  const ui = archiveUiCategory(item);
  if (ui === "deepspace" || ui === "spacestation") {
    return ui;
  }
  return isCategory(item.category) ? item.category : null;
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

export function saveSlotUiCategory(item: ExtractedSlot): Category {
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

export function sessionCategoryForArchived(
  item: ArchiveCategoryHint,
): Category | null {
  const ui = archiveUiCategory(item);
  return isCategory(ui) ? ui : null;
}

/** @deprecated use matchingItems */
export function matchingShips(
  ships: ExtractedSlot[],
  seed: string,
  category: string,
): ExtractedSlot[] {
  return matchingItems(ships, seed, category);
}
