import { getAdapter, type AdapterColumn } from "@/lib/nms/extract";
import { archiveUiCategory } from "@/lib/archive-match";
import { asString } from "@/lib/nms/value";
import type { ArchivedItemExtra, ArchivedItemSummary } from "@/types/archive";
import { CATEGORY_META, isCategory, type Category } from "@/types/nms";

const WIDTH: Record<string, string> = {
  slot: "w-16",
  className: "w-28",
  itemType: "w-40",
  category: "w-40",
  traits: "w-24",
  level: "w-20",
  element: "w-32",
  biome: "w-36",
  objects: "w-24",
  slots: "w-24",
  tech: "w-24",
  supercharged: "w-32",
  stat: "w-28",
  tags: "w-44",
  actions: "w-80",
};

export function listColumnClass(id: string): string {
  return WIDTH[id] ?? "";
}

const LIST_EXTRA_KEYS = [
  "baseType",
  "biome",
  "element",
  "level",
  "traits",
  "objects",
  "slots",
  "tech",
  "supercharged",
] as const satisfies readonly (keyof ArchivedItemExtra)[];

export function pickListExtra(
  source: Record<string, unknown> | null | undefined,
): ArchivedItemExtra {
  const extra: ArchivedItemExtra = {};
  if (!source) return extra;
  for (const key of LIST_EXTRA_KEYS) {
    const value = asString(source[key]);
    if (value) extra[key] = value;
  }
  return extra;
}

export function dataColumns(category: Category): AdapterColumn[] {
  const columns = getAdapter(category).columns.filter((col) => col.id !== "seed");
  if (category === "companion" && !columns.some((col) => col.id === "className")) {
    return [{ id: "className", header: "Class" }, ...columns];
  }
  return columns;
}

export function allViewColumns(): AdapterColumn[] {
  return [
    { id: "category", header: "Category" },
    { id: "itemType", header: "Type" },
    { id: "className", header: "Class" },
  ];
}

export function archiveDataColumns(category?: Category): AdapterColumn[] {
  return category ? dataColumns(category) : allViewColumns();
}

export function archiveColumnValue(
  item: ArchivedItemSummary,
  col: AdapterColumn,
): string {
  if (col.id === "className") return item.className;
  if (col.id === "itemType") return item.shipType;
  if (col.id === "category") {
    const ui = archiveUiCategory(item);
    return isCategory(ui) ? CATEGORY_META[ui].label : item.category;
  }
  const extra = item.extra;
  if (!extra) return "";
  const value = extra[col.id as keyof ArchivedItemExtra];
  return value ?? "";
}
