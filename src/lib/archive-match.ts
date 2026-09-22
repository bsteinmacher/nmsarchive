import {
  DEEP_SPACE_BASE_TYPE,
  DEEP_SPACE_LABEL,
  FREIGHTER_BASE_LABEL_ALIASES,
  FREIGHTER_BASE_TYPE,
  SPACE_STATION_BASE_TYPE,
  SPACE_STATION_LABEL,
  isFreighterBaseSlot,
} from "@/lib/nms/extract/bases";
import type { ExtractedSlot } from "@/lib/nms/extract/types";
import { asRecord, normalizeSeed } from "@/lib/nms/value";
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
    (item.shipType != null &&
      (FREIGHTER_BASE_LABEL_ALIASES as readonly string[]).includes(
        item.shipType,
      ))
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

function nonZeroSeeds(...seeds: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seed of seeds) {
    const normalized = seed?.toLowerCase();
    if (!normalized || normalized === "0x0" || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function uniqueCompanionCreatureSeedHits(
  items: ExtractedSlot[],
  seed: string,
): ExtractedSlot[] {
  if (!seed || seed === "0x0") return [];
  const hits = items.filter((item) => {
    if (item.empty || item.readonly || item.category !== "companion") {
      return false;
    }
    return (
      normalizeSeed(asRecord(item.payload)?.CreatureSeed).toLowerCase() === seed
    );
  });
  return hits.length === 1 ? hits : [];
}

export function matchingItems(
  items: ExtractedSlot[],
  seed: string,
  category: string,
  identitySeed?: string | null,
): ExtractedSlot[] {
  const needles = nonZeroSeeds(identitySeed, seed);
  if (needles.length === 0) {
    return [];
  }
  const hits = items.filter(
    (item) =>
      !item.empty &&
      !item.readonly &&
      item.category === category &&
      needles.includes(item.seed.toLowerCase()),
  );
  if (hits.length > 0) return hits;
  if (category !== "companion") return [];
  return uniqueCompanionCreatureSeedHits(items, seed.toLowerCase());
}

export function matchingSlotsForArchived(
  slots: ExtractedSlot[],
  item: ArchiveCategoryHint & {
    seed: string;
    identitySeed?: string | null;
  },
): ExtractedSlot[] {
  const category = sessionCategoryForArchived(item);
  if (!category) return [];
  return matchingItems(slots, item.seed, category, item.identitySeed);
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
  return items.filter((item) => {
    if (archiveUiCategory(item) !== uiCategory) return false;
    return nonZeroSeeds(item.identitySeed, item.seed).includes(normalized);
  });
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
