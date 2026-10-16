import { companionSpeciesTag } from "@/lib/nms/extract/names";
import {
  companionClassFromRank,
  companionRankFromMetadata,
} from "@/lib/nms/extract/companion-battle";
import { formatGalaxy } from "@/lib/nms/galaxies";
import {
  archiveMultitoolType,
  MULTITOOL_TYPES,
} from "@/lib/nms/multitool-type";
import { asRecord } from "@/lib/nms/value";
import { slugifyTag } from "@/lib/validations";
import type { ExtractedSlot } from "@/lib/nms/extract/types";
import type { ArchivedItemSummary } from "@/types/archive";

const SKIP_EXTRA = new Set([
  "filename",
  "role",
  "baseType",
  "descriptors",
  "class",
  "kind",
  "source",
  "stat",
  "rank",
  "atk",
  "agi",
  "hp",
  "species",
  "shipType",
]);

const CLASS_SLUGS = new Set(["sss", "ss", "s", "a", "b", "c"]);

const MULTITOOL_TYPE_SLUGS = new Set(
  [
    ...MULTITOOL_TYPES,
    "Multi-tool",
    "Staff",
    "Atlas Staff",
    "Atlas",
    "Royal",
    "Fishing",
  ].map((label) => slugifyTag(label)),
);

function usesLocationTags(category: string): boolean {
  return category === "base";
}

function pushUnique(tags: string[], value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return;
  const slug = slugifyTag(trimmed);
  if (!slug) return;
  if (tags.some((tag) => slugifyTag(tag) === slug)) return;
  tags.push(trimmed);
}

export function isClassTag(label: string): boolean {
  return CLASS_SLUGS.has(slugifyTag(label));
}

export function replaceClassTag(tags: string[], className: string): string[] {
  const without = tags.filter((tag) => !isClassTag(tag));
  pushUnique(without, className);
  return without;
}

export function isMultitoolTypeTag(label: string): boolean {
  return MULTITOOL_TYPE_SLUGS.has(slugifyTag(label));
}

export function replaceMultitoolTypeTag(tags: string[], type: string): string[] {
  const without = tags.filter((tag) => !isMultitoolTypeTag(tag));
  pushUnique(without, type);
  return without;
}

function multitoolTypeTag(label: string | null | undefined): string {
  if (!label) return "";
  return archiveMultitoolType(label);
}

export function autoTagsFromSlot(item: ExtractedSlot): string[] {
  if (item.empty || item.readonly) return [];
  const tags: string[] = [];
  if (item.category === "companion") {
    const rec = asRecord(item.payload);
    pushUnique(tags, companionSpeciesTag(rec?.CreatureID ?? item.itemType));
    pushUnique(tags, item.extra.element);
    pushUnique(tags, item.extra.biome);
    pushUnique(tags, item.extra.level ? `Level ${item.extra.level}` : "");
    const rank = companionRankFromMetadata({
      className: item.className,
      extra: item.extra,
    });
    pushUnique(tags, companionClassFromRank(rank) || item.className);
  } else if (item.category === "multitool") {
    pushUnique(tags, multitoolTypeTag(item.itemType));
    pushUnique(tags, item.className);
  } else {
    pushUnique(tags, item.itemType);
    pushUnique(tags, item.className);
  }
  if (usesLocationTags(item.category)) {
    pushUnique(tags, item.extra.galaxy);
    pushUnique(tags, item.extra.planet);
    pushUnique(tags, item.extra.planetType);
  }
  if (item.extra.objects) pushUnique(tags, `${item.extra.objects} objects`);
  for (const [key, value] of Object.entries(item.extra)) {
    if (SKIP_EXTRA.has(key) || key === "itemType" || key === "objects") continue;
    if (key === "element" || key === "biome" || key === "level") continue;
    if (key === "galaxy" || key === "planet" || key === "planetType") continue;
    pushUnique(tags, value);
  }
  return tags;
}

export function autoTagsFromArchived(item: ArchivedItemSummary): string[] {
  const tags: string[] = [];
  if (item.category === "companion") {
    pushUnique(tags, companionSpeciesTag(item.shipType));
    pushUnique(tags, item.extra?.element);
    pushUnique(tags, item.extra?.biome);
    pushUnique(tags, item.extra?.level ? `Level ${item.extra.level}` : "");
    const rank = companionRankFromMetadata({
      className: item.className,
      extra: item.extra ?? {},
    });
    pushUnique(tags, companionClassFromRank(rank) || item.className);
  } else if (item.category === "multitool") {
    pushUnique(tags, multitoolTypeTag(item.shipType));
    pushUnique(tags, item.className);
  } else {
    pushUnique(tags, item.shipType);
    pushUnique(tags, item.className);
  }
  if (usesLocationTags(item.category)) {
    if (item.galaxy != null) pushUnique(tags, formatGalaxy(item.galaxy));
    pushUnique(tags, item.extra?.planet);
    pushUnique(tags, item.extra?.planetType);
  }
  if (item.extra?.objects) pushUnique(tags, `${item.extra.objects} objects`);
  return tags;
}

export function mergeAutoTags(existing: string[], auto: string[]): string[] {
  const next = [...existing];
  for (const tag of auto) pushUnique(next, tag);
  return next;
}

export function slotCardTags(item: ExtractedSlot): string[] {
  return autoTagsFromSlot(item);
}
