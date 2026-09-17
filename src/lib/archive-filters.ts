import { slugifyTag } from "@/lib/validations";

export type ArchiveFilterInput = {
  className?: string;
  itemType?: string;
  tags?: string[];
  galaxy?: number;
  q?: string;
  seed?: string;
};

export type ArchiveFilterable = {
  name: string;
  description: string;
  seed: string;
  className: string;
  shipType: string;
  galaxy: number | null;
  tags: { slug: string }[];
};

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Tags do filtro casam por slug (AND). Labels são normalizadas. */
export function filterTagSlugs(tags: string[]): string[] {
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const tag of tags) {
    const slug = slugifyTag(tag);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
}

export function matchesArchiveFilters(
  item: ArchiveFilterable,
  filters: ArchiveFilterInput,
): boolean {
  if (filters.className) {
    if (item.className.toUpperCase() !== filters.className.toUpperCase()) {
      return false;
    }
  }
  if (filters.itemType) {
    if (!includesInsensitive(item.shipType, filters.itemType)) {
      return false;
    }
  }
  if (filters.galaxy != null) {
    if (item.galaxy !== filters.galaxy) return false;
  }
  if (filters.seed) {
    if (item.seed.toLowerCase() !== filters.seed.toLowerCase()) return false;
  }
  if (filters.q) {
    const q = filters.q.trim();
    if (
      !includesInsensitive(item.name, q) &&
      !includesInsensitive(item.description, q)
    ) {
      return false;
    }
  }
  if (filters.tags && filters.tags.length > 0) {
    const have = new Set(item.tags.map((t) => t.slug));
    for (const slug of filterTagSlugs(filters.tags)) {
      if (!have.has(slug)) return false;
    }
  }
  return true;
}

export function hasActiveArchiveFilters(filters: ArchiveFilterInput): boolean {
  return Boolean(
    filters.className ||
      filters.itemType ||
      (filters.tags && filters.tags.length > 0) ||
      filters.galaxy != null ||
      filters.q ||
      filters.seed,
  );
}
