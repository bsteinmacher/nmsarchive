import { getAdapter, type AdapterColumn } from "@/lib/nms/extract";
import { archiveUiCategory } from "@/lib/archive-match";
import { formatBiomeTag, formatClassTag } from "@/lib/auto-tags";
import { asString } from "@/lib/nms/value";
import { slugifyTag } from "@/lib/validations";
import type { ArchivedItemExtra, ArchivedItemSummary } from "@/types/archive";
import { CATEGORY_META, isCategory, type Category } from "@/types/nms";

export type TableDataColumn = AdapterColumn & {
  /** Reserva a largura sem título nem valor, para as tabelas do grupo alinharem. */
  reserved?: boolean;
};

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
  "planet",
  "planetType",
  "galaxy",
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

const CATEGORY_TAG: Record<string, string> = {
  ship: "Ship",
  multitool: "Multi-tool",
  freighter: "Freighter",
  frigate: "Frigate",
};

/**
 * Freighter, interior e fragatas ficam em cards separados. A grade é a mesma
 * (Class, Type, uma coluna extra, Tags) para os valores caírem na mesma posição.
 */
export function freighterGroupColumns(category: Category): TableDataColumn[] {
  const metric: TableDataColumn =
    category === "base"
      ? { id: "objects", header: "Objects" }
      : category === "frigate"
        ? { id: "traits", header: "Traits" }
        : { id: "traits", header: "Traits", reserved: true };

  const className: TableDataColumn =
    category === "base"
      ? { id: "className", header: "Class", reserved: true }
      : { id: "className", header: "Class" };

  return [className, { id: "itemType", header: "Type" }, metric];
}

/** Mesma grade do arquivo, no save aberto. O esquadrão usa Rank no lugar de Class. */
export function saveFreighterColumns(
  kind: "freighter" | "base" | "frigate" | "squadron",
): TableDataColumn[] {
  if (kind === "squadron") {
    return [
      { id: "className", header: "Rank" },
      { id: "itemType", header: "Type" },
      { id: "traits", header: "Traits", reserved: true },
    ];
  }
  return freighterGroupColumns(kind);
}

/** Planet Bases, Deep Space e Space Stations: Type e Objects na mesma posição. */
export function saveBaseColumns(): TableDataColumn[] {
  return [
    { id: "itemType", header: "Type" },
    { id: "objects", header: "Objects" },
  ];
}

function hideTag(hidden: Set<string>, value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return;
  hidden.add(slugifyTag(trimmed));
}

/** Tags que a tabela já mostra em outra coluna, ou que só repetem a categoria. */
export function tableTagLabels(
  item: ArchivedItemSummary,
  columns: readonly AdapterColumn[],
): string[] {
  const hidden = new Set<string>();
  hideTag(hidden, CATEGORY_TAG[item.category]);

  for (const col of columns) {
    const value = archiveColumnValue(item, col).trim();
    hideTag(hidden, value);
    if (col.id === "className") hideTag(hidden, formatClassTag(value));
    if (col.id === "level" && value && !/^level\b/i.test(value)) {
      hideTag(hidden, `Level ${value}`);
    }
    if (col.id === "biome") hideTag(hidden, formatBiomeTag(value));
    if (col.id === "objects" && value) hideTag(hidden, `${value} objects`);
  }

  return item.tags
    .map((tag) => tag.label)
    .filter((label) => !hidden.has(slugifyTag(label)));
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
