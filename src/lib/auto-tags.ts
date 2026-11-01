import { companionSpeciesTag } from "@/lib/nms/extract/names";
import {
  companionClassFromRank,
  companionRankFromMetadata,
  normalizeItemClass,
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
  "unlocked",
]);

const CLASS_SLUGS = new Set(["sss", "ss", "s", "a", "b", "c"]);

const CATEGORY_TAG: Record<string, string> = {
  ship: "Ship",
  multitool: "Multi-tool",
  freighter: "Freighter",
  frigate: "Frigate",
  squadron: "Squadron",
};

const MULTITOOL_CATEGORY = "Multi-tool";

const MULTITOOL_TYPE_SLUGS = new Set(
  [
    ...MULTITOOL_TYPES,
    "Staff",
    "Atlas Staff",
    "Atlas",
    "Royal",
    "Fishing",
  ].map((label) => slugifyTag(label)),
);

const LEVEL_TAG = /^level-\d+$/;

function usesLocationTags(category: string): boolean {
  return category === "base";
}

function usesOrderedAutoTags(category: string): boolean {
  return category in CATEGORY_TAG || category === "companion";
}

function pushUnique(tags: string[], value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return;
  const slug = slugifyTag(trimmed);
  if (!slug) return;
  if (tags.some((tag) => slugifyTag(tag) === slug)) return;
  tags.push(trimmed);
}

function classBareSlug(label: string): string | null {
  const slug = slugifyTag(label);
  if (CLASS_SLUGS.has(slug)) return slug;
  if (!slug.endsWith("-class")) return null;
  const bare = slug.slice(0, -"-class".length);
  return CLASS_SLUGS.has(bare) ? bare : null;
}

export function isClassTag(label: string): boolean {
  return classBareSlug(label) != null;
}

export function formatClassTag(className: string | null | undefined): string {
  const raw = className?.trim() ?? "";
  if (!raw) return "";
  const bare = classBareSlug(raw);
  if (bare) return `${bare.toUpperCase()} Class`;
  const normalized = normalizeItemClass(raw);
  if (normalized && CLASS_SLUGS.has(slugifyTag(normalized))) {
    return `${normalized} Class`;
  }
  return raw;
}

export function formatBiomeTag(biome: string | null | undefined): string {
  const raw = biome?.trim() ?? "";
  if (!raw) return "";
  const stem = raw.replace(/\s*biome$/i, "").trim();
  if (!stem) return "";
  return `${stem} Biome`;
}

function biomeStemSlug(label: string): string | null {
  if (!/\sbiome$/i.test(label.trim())) return null;
  const stem = label.trim().replace(/\s*biome$/i, "").trim();
  return stem ? slugifyTag(stem) : null;
}

export function replaceClassTag(tags: string[], className: string): string[] {
  const formatted = formatClassTag(className);
  const without = tags.filter((tag) => !isClassTag(tag));
  if (!formatted) return without;
  return [formatted, ...without.filter((tag) => slugifyTag(tag) !== slugifyTag(formatted))];
}

export function isMultitoolTypeTag(label: string): boolean {
  const slug = slugifyTag(label);
  if (slug === slugifyTag(MULTITOOL_CATEGORY)) return false;
  return MULTITOOL_TYPE_SLUGS.has(slug);
}

export function replaceMultitoolTypeTag(tags: string[], type: string): string[] {
  const without = tags.filter((tag) => !isMultitoolTypeTag(tag));
  const trimmed = type.trim();
  const typeLabel =
    trimmed && slugifyTag(trimmed) !== slugifyTag(MULTITOOL_CATEGORY)
      ? trimmed
      : "";
  const classes: string[] = [];
  const rest: string[] = [];
  let category = false;
  for (const tag of without) {
    if (isClassTag(tag)) {
      classes.push(tag);
      continue;
    }
    if (slugifyTag(tag) === slugifyTag(MULTITOOL_CATEGORY)) {
      category = true;
      continue;
    }
    rest.push(tag);
  }
  const next: string[] = [];
  for (const label of [
    ...classes,
    ...(typeLabel ? [typeLabel] : []),
    ...(category ? [MULTITOOL_CATEGORY] : []),
    ...rest,
  ]) {
    pushUnique(next, label);
  }
  return next;
}

function multitoolTypeTag(label: string | null | undefined): string {
  if (!label) return "";
  return archiveMultitoolType(label);
}

function companionClassTag(input: {
  className?: string | null;
  extra?: Record<string, string> | null;
}): string {
  const rank = companionRankFromMetadata({
    className: input.className,
    extra: input.extra ?? {},
  });
  return formatClassTag(companionClassFromRank(rank) || input.className || "");
}

function pushCompanionTags(
  tags: string[],
  input: {
    species: string;
    element?: string | null;
    biome?: string | null;
    level?: string | null;
    className?: string | null;
    extra?: Record<string, string> | null;
  },
) {
  pushUnique(tags, companionClassTag(input));
  pushUnique(tags, input.element);
  pushUnique(tags, input.species);
  pushUnique(tags, input.level ? `Level ${input.level}` : "");
  pushUnique(tags, formatBiomeTag(input.biome));
}

function pushVehicleTags(
  tags: string[],
  category: string,
  className: string | null | undefined,
  type: string | null | undefined,
) {
  pushUnique(tags, formatClassTag(className));
  if (category === "multitool") {
    pushUnique(tags, multitoolTypeTag(type));
    pushUnique(tags, MULTITOOL_CATEGORY);
    return;
  }
  pushUnique(tags, type);
  pushUnique(tags, CATEGORY_TAG[category]);
}

export function autoTagsFromSlot(item: ExtractedSlot): string[] {
  if (item.empty || item.readonly) return [];
  const tags: string[] = [];
  if (item.category === "companion") {
    const rec = asRecord(item.payload);
    pushCompanionTags(tags, {
      species: companionSpeciesTag(rec?.CreatureID ?? item.itemType),
      element: item.extra.element,
      biome: item.extra.biome,
      level: item.extra.level,
      className: item.className,
      extra: item.extra,
    });
  } else if (usesOrderedAutoTags(item.category)) {
    pushVehicleTags(tags, item.category, item.className, item.itemType);
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
    pushCompanionTags(tags, {
      species: companionSpeciesTag(item.shipType),
      element: item.extra?.element,
      biome: item.extra?.biome,
      level: item.extra?.level,
      className: item.className,
      extra: item.extra,
    });
  } else if (usesOrderedAutoTags(item.category)) {
    pushVehicleTags(tags, item.category, item.className, item.shipType);
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

/** Tags automáticas na frente, na ordem da categoria; o resto fica depois. */
export function alignAutoTags(existing: string[], auto: string[]): string[] {
  const autoSlugs = new Set(auto.map((label) => slugifyTag(label)));
  const hasClass = auto.some((label) => isClassTag(label));
  const hasLevel = auto.some((label) => LEVEL_TAG.test(slugifyTag(label)));
  const biomeStems = new Set(
    auto
      .map((label) => biomeStemSlug(label))
      .filter((slug): slug is string => Boolean(slug)),
  );
  const manual = existing.filter((label) => {
    const slug = slugifyTag(label);
    if (autoSlugs.has(slug)) return false;
    if (hasClass && isClassTag(label)) return false;
    if (hasLevel && LEVEL_TAG.test(slug)) return false;
    if (biomeStems.has(slug)) return false;
    return true;
  });
  const next: string[] = [];
  for (const label of [...auto, ...manual]) pushUnique(next, label);
  return next;
}

export function mergeAutoTags(existing: string[], auto: string[]): string[] {
  return alignAutoTags(existing, auto);
}

export function slotCardTags(item: ExtractedSlot): string[] {
  return autoTagsFromSlot(item);
}
