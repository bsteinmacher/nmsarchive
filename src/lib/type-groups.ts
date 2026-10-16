import type { ArchiveFilterOptions } from "@/types/archive";
import { CATEGORY_META, isCategory, type Category } from "@/types/nms";

export const TYPE_GROUP_ORDER = [
  "multitool",
  "companion",
  "ship",
  "freighter",
  "frigate",
  "base",
  "wonder",
  "exosuit",
] as const;

export type TypeGroupId = (typeof TYPE_GROUP_ORDER)[number];

export type ArchiveTypeGroup = {
  id: TypeGroupId;
  label: string;
  types: string[];
};

const GROUP_LABEL: Record<TypeGroupId, string> = {
  multitool: "Multi Tools",
  companion: "Companions",
  ship: "Ships",
  freighter: "Freighters",
  frigate: "Frigates",
  base: "Bases",
  wonder: "Wonders",
  exosuit: "Exosuit",
};

export function typeGroupForCategory(category: string): TypeGroupId | null {
  if (category === "deepspace" || category === "spacestation") return "base";
  if ((TYPE_GROUP_ORDER as readonly string[]).includes(category)) {
    return category as TypeGroupId;
  }
  return isCategory(category) ? (category as TypeGroupId) : null;
}

export function groupArchiveTypes(
  items: Array<{ category: string; shipType: string }>,
): ArchiveTypeGroup[] {
  const buckets = new Map<TypeGroupId, Set<string>>();
  for (const item of items) {
    if (!item.shipType) continue;
    const group = typeGroupForCategory(item.category);
    if (!group) continue;
    const set = buckets.get(group) ?? new Set<string>();
    set.add(item.shipType);
    buckets.set(group, set);
  }
  return TYPE_GROUP_ORDER.flatMap((id) => {
    const types = [...(buckets.get(id) ?? [])].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
    if (types.length === 0) return [];
    return [{ id, label: GROUP_LABEL[id], types }];
  });
}

export function typeGroupLabel(category: Category): string {
  const group = typeGroupForCategory(category);
  return group ? GROUP_LABEL[group] : CATEGORY_META[category].label;
}

export const EMPTY_FILTER_OPTIONS: ArchiveFilterOptions = {
  classes: [],
  types: [],
  typeGroups: [],
  galaxies: [],
  tags: [],
};

export function mergeArchiveFilterOptions(
  parts: Array<ArchiveFilterOptions | undefined>,
): ArchiveFilterOptions {
  const items: { category: string; shipType: string }[] = [];
  const tags = new Map<string, string>();
  const classes = new Set<string>();
  const galaxies = new Set<number>();
  for (const part of parts) {
    if (!part) continue;
    for (const group of part.typeGroups) {
      for (const type of group.types) {
        items.push({ category: group.id, shipType: type });
      }
    }
    for (const tag of part.tags) {
      if (!tags.has(tag.slug)) tags.set(tag.slug, tag.label);
    }
    for (const value of part.classes) classes.add(value);
    for (const galaxy of part.galaxies) galaxies.add(galaxy);
  }
  const typeList = [
    ...new Set(items.map((item) => item.shipType)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    classes: [...classes].sort(),
    types: typeList,
    typeGroups: groupArchiveTypes(items),
    galaxies: [...galaxies].sort((a, b) => a - b),
    tags: [...tags.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slug, label]) => ({ slug, label })),
  };
}
