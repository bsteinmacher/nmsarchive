import { parseGalaxyDisplay } from "@/lib/nms/galaxies";
import { ITEM_CLASSES } from "@/lib/validations";

export type ArchiveView = "grid" | "table";

export type ArchiveUrlState = {
  className?: string;
  itemType?: string;
  tags: string[];
  galaxyDisplay?: number;
  q?: string;
  view: ArchiveView;
};

function first(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  return value || undefined;
}

export function parseArchiveSearch(params: URLSearchParams): ArchiveUrlState {
  const classRaw = first(params, "class");
  const className = classRaw?.toUpperCase();
  const tagsRaw = first(params, "tags");
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const galaxyRaw = first(params, "galaxy");
  let galaxyDisplay: number | undefined;
  if (galaxyRaw) {
    const n = Number(galaxyRaw);
    try {
      parseGalaxyDisplay(n);
      galaxyDisplay = n;
    } catch {
      galaxyDisplay = undefined;
    }
  }
  const viewRaw = first(params, "view");
  return {
    className:
      className && className.length <= 16 ? className : undefined,
    itemType: first(params, "type"),
    tags,
    galaxyDisplay,
    q: first(params, "q"),
    view: viewRaw === "table" ? "table" : "grid",
  };
}

export function serializeArchiveSearch(
  state: ArchiveUrlState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.className) params.set("class", state.className);
  if (state.itemType) params.set("type", state.itemType);
  if (state.tags.length) params.set("tags", state.tags.join(","));
  if (state.galaxyDisplay != null) {
    params.set("galaxy", String(state.galaxyDisplay));
  }
  if (state.q) params.set("q", state.q);
  if (state.view === "table") params.set("view", "table");
  return params;
}

export function archiveSearchHref(
  pathname: string,
  state: ArchiveUrlState,
): string {
  const qs = serializeArchiveSearch(state).toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export const CLASS_FILTER_OPTIONS = ITEM_CLASSES.map((value) => ({
  value,
  label: `Class ${value}`,
}));
