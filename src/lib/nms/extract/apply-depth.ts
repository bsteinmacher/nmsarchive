import type { Category } from "@/types/nms";
import { freighterTypeFromFilename } from "../freighter-type";
import { multitoolTypeFromFilename } from "../multitool-type";
import { shipTypeFromFilename } from "../ship-type";
import { asArray, asRecord, asString } from "../value";
import { isTechSlot } from "./inventory-layout";
import type { ExtractedSlot } from "./types";

/** Re-skin = partes marcadas. Trocar = slots + tech, inventário vazio. */
export const APPLY_DEPTHS = ["model", "tech"] as const;

export type ApplyDepth = (typeof APPLY_DEPTHS)[number];

export const APPLY_OVERLAY_MODES = [
  {
    id: "model" as const,
    label: "Re-skin",
    hint: "Marque o que vem do item. O resto fica neste slot.",
  },
  {
    id: "tech" as const,
    label: "Trocar",
    hint: "Slots e tecnologias da origem. Inventário fica vazio.",
  },
] as const;

export type CompanionLevelChoice = "archived" | "zero";

export const APPLY_PART_IDS = [
  "name",
  "model",
  "class",
  "slots",
  "inventory",
  "technologies",
  "origin",
] as const;

export type ApplyPart = (typeof APPLY_PART_IDS)[number];

export type ApplyParts = Record<ApplyPart, boolean>;

export const APPLY_PART_FIELDS: {
  id: ApplyPart;
  label: string;
  freighterOnly?: boolean;
}[] = [
  { id: "name", label: "Nome" },
  { id: "model", label: "Modelo" },
  { id: "class", label: "Classe" },
  { id: "slots", label: "Slots" },
  { id: "inventory", label: "Inventário" },
  { id: "technologies", label: "Tecnologias" },
  { id: "origin", label: "Sistema de origem", freighterOnly: true },
];

export function applyPartOptions(
  category: "ship" | "multitool" | "freighter",
): { id: ApplyPart; label: string }[] {
  return APPLY_PART_FIELDS.filter(
    (field) => category === "freighter" || !field.freighterOnly,
  );
}

/** O que o Re-skin marca ao abrir. Na cargueira a classe fica no slot. */
export function defaultApplyParts(
  category: "ship" | "multitool" | "freighter",
): ApplyParts {
  const freighter = category === "freighter";
  return {
    name: freighter,
    model: true,
    class: !freighter,
    slots: false,
    inventory: false,
    technologies: false,
    origin: freighter,
  };
}

export type ApplyRequest = {
  index?: number;
  depth?: ApplyDepth;
  parts?: ApplyParts;
  companionLevel?: CompanionLevelChoice;
};

const CHOICE_CATEGORIES = ["ship", "multitool", "freighter", "companion"] as const;

export type ApplyChoiceCategory = (typeof CHOICE_CATEGORIES)[number];

export function usesApplyChoices(
  category: string,
): category is ApplyChoiceCategory {
  return (CHOICE_CATEGORIES as readonly string[]).includes(category);
}

/** Naves, multi-tools, cargueira e esquadrão perguntam o slot de destino. */
export function usesSlotPicker(category: string): boolean {
  return usesApplyDepth(category) || category === "squadron";
}

export function usesApplyDepth(
  category: string,
): category is "ship" | "multitool" | "freighter" {
  return (
    category === "ship" || category === "multitool" || category === "freighter"
  );
}

export type ApplyMergeSpec = {
  visual: readonly string[];
  grids: readonly string[];
  /** Campos do destino que permanecem no overlay. */
  keep: readonly string[];
  layoutKey?: string;
};

export const SHIP_MERGE: ApplyMergeSpec = {
  visual: ["Resource", "Seed"],
  grids: ["Inventory", "Inventory_TechOnly", "Inventory_Cargo"],
  keep: ["Name", "Location", "Position", "Direction"],
  layoutKey: "InventoryLayout",
};

export const MULTITOOL_MERGE: ApplyMergeSpec = {
  visual: ["Resource", "Seed", "CustomisationData", "IsLarge", "ScreenData"],
  grids: ["Store"],
  keep: ["Name"],
};

export const FREIGHTER_MERGE: ApplyMergeSpec = {
  visual: ["Resource", "HomeSystemSeed"],
  grids: ["Inventory", "Inventory_TechOnly", "Inventory_Cargo"],
  keep: ["HomeSystemSeed"],
};

function copyInventoryClass(
  dest: Record<string, unknown>,
  source: Record<string, unknown>,
) {
  const className = asString(asRecord(source.Class)?.InventoryClass);
  if (!className) return;
  const prev = asRecord(dest.Class) ?? {};
  dest.Class = { ...prev, InventoryClass: className };
}

/** Produtos e substâncias saem; tecnologia fica. */
export function stripGridCargo(grid: unknown): unknown {
  const rec = asRecord(grid);
  if (!rec) return grid;
  const next = structuredClone(rec);
  const slots = Array.isArray(next.Slots) ? next.Slots : [];
  next.Slots = slots.filter(isTechSlot);
  return next;
}

export function stripSpecGrids(
  rec: Record<string, unknown>,
  spec: ApplyMergeSpec,
): Record<string, unknown> {
  const next = structuredClone(rec);
  for (const gridKey of spec.grids) {
    if (gridKey in next) next[gridKey] = stripGridCargo(next[gridKey]);
  }
  return next;
}

export function mergeGrid(
  destGrid: unknown,
  sourceGrid: unknown,
  depth: ApplyDepth,
): unknown {
  const source = asRecord(sourceGrid);
  if (!source) return destGrid;
  if (depth === "tech") {
    const next = asRecord(stripGridCargo(source));
    if (!next) return destGrid;
    const dest = asRecord(destGrid);
    if (dest && "Name" in dest) next.Name = structuredClone(dest.Name);
    return next;
  }

  const dest = structuredClone(asRecord(destGrid) ?? {});
  copyInventoryClass(dest, source);
  return dest;
}

export function mergeApply(
  dest: unknown,
  source: Record<string, unknown>,
  depth: ApplyDepth,
  spec: ApplyMergeSpec,
): Record<string, unknown> {
  const destRec = asRecord(dest) ?? {};
  if (depth === "tech") {
    const next = stripSpecGrids(source, spec);
    for (const key of spec.keep) {
      if (key in destRec) next[key] = structuredClone(destRec[key]);
    }
    for (const gridKey of spec.grids) {
      if (!(gridKey in next)) continue;
      next[gridKey] = mergeGrid(destRec[gridKey], next[gridKey], "tech");
    }
    return next;
  }

  const next = structuredClone(destRec);
  for (const key of spec.visual) {
    if (key in source) next[key] = structuredClone(source[key]);
  }
  for (const gridKey of spec.grids) {
    if (!(gridKey in source) && !(gridKey in next)) continue;
    next[gridKey] = mergeGrid(next[gridKey], source[gridKey], depth);
  }
  return next;
}

const SLOT_LAYOUT_KEYS = [
  "ValidSlotIndices",
  "SpecialSlots",
  "StackSizeGroup",
  "Width",
  "Height",
  "IsCool",
  "Version",
  "NumSlotsFromTech",
] as const;

function slotXY(slot: unknown): { x: number; y: number } | null {
  const index = asRecord(asRecord(slot)?.Index);
  if (!index || typeof index.X !== "number" || typeof index.Y !== "number") {
    return null;
  }
  return { x: index.X, y: index.Y };
}

/** Item fora da grade nova sai. Sem geometria reconhecível, o item fica. */
function fitsGrid(slot: unknown, grid: Record<string, unknown>): boolean {
  const xy = slotXY(slot);
  if (!xy) return true;
  const valid = asArray(grid.ValidSlotIndices);
  if (valid && valid.length > 0) {
    const points = valid.every((entry) => {
      const rec = asRecord(entry);
      return rec != null && typeof rec.X === "number" && typeof rec.Y === "number";
    });
    if (points) {
      return valid.some((entry) => {
        const rec = asRecord(entry);
        return rec?.X === xy.x && rec?.Y === xy.y;
      });
    }
    return true;
  }
  if (typeof grid.Width === "number" && typeof grid.Height === "number") {
    return xy.x >= 0 && xy.y >= 0 && xy.x < grid.Width && xy.y < grid.Height;
  }
  return true;
}

export function mergeGridParts(
  destGrid: unknown,
  sourceGrid: unknown,
  parts: ApplyParts,
): unknown {
  const touches =
    parts.class ||
    parts.slots ||
    parts.name ||
    parts.inventory ||
    parts.technologies;
  if (!touches) return destGrid;
  const source = asRecord(sourceGrid);
  if (!source) return destGrid;
  const dest = structuredClone(asRecord(destGrid) ?? {});
  if (parts.class) copyInventoryClass(dest, source);
  if (parts.name && "Name" in source) dest.Name = structuredClone(source.Name);
  if (parts.slots) {
    for (const key of SLOT_LAYOUT_KEYS) {
      if (key in source) dest[key] = structuredClone(source[key]);
    }
  }
  if (parts.slots || parts.inventory || parts.technologies) {
    const destSlots = asArray(dest.Slots) ?? [];
    const sourceSlots = asArray(source.Slots) ?? [];
    const tech = (parts.technologies ? sourceSlots : destSlots).filter(isTechSlot);
    const cargo = (parts.inventory ? sourceSlots : destSlots).filter(
      (slot) => !isTechSlot(slot),
    );
    const ordered =
      parts.inventory && parts.technologies ? sourceSlots : [...tech, ...cargo];
    dest.Slots = ordered.filter((slot) => fitsGrid(slot, dest));
  }
  return dest;
}

export function mergeApplyParts(
  dest: unknown,
  source: Record<string, unknown>,
  spec: ApplyMergeSpec,
  parts: ApplyParts,
  options?: { originKeys?: readonly string[] },
): Record<string, unknown> {
  const next = structuredClone(asRecord(dest) ?? {});
  const origin = new Set(options?.originKeys ?? []);
  if (parts.model) {
    for (const key of spec.visual) {
      if (origin.has(key)) continue;
      if (key in source) next[key] = structuredClone(source[key]);
    }
  }
  if (parts.name && "Name" in source) next.Name = structuredClone(source.Name);
  if (parts.origin) {
    for (const key of origin) {
      if (key in source) next[key] = structuredClone(source[key]);
    }
  }
  if (parts.slots && spec.layoutKey && spec.layoutKey in source) {
    next[spec.layoutKey] = structuredClone(source[spec.layoutKey]);
  }
  for (const gridKey of spec.grids) {
    if (!(gridKey in source) && !(gridKey in next)) continue;
    next[gridKey] = mergeGridParts(next[gridKey], source[gridKey], parts);
  }
  return next;
}

export function zeroCompanionTreats(payload: unknown): unknown {
  const rec = asRecord(payload);
  if (!rec) return payload;
  return { ...structuredClone(rec), PetBattlerTreatsEaten: [0, 0, 0] };
}

export function applyTargetSlots(
  category: Category,
  slots: ExtractedSlot[],
): ExtractedSlot[] {
  const usable = slots.filter(
    (slot) =>
      !slot.readonly &&
      slot.group !== "automatic" &&
      !(category === "freighter" && slot.index !== 0),
  );
  if (category !== "freighter") return usable;
  return usable.filter((slot) => slot.index === 0);
}

export function defaultApplyIndex(slots: ExtractedSlot[]): number | null {
  const empty = slots.find((slot) => slot.empty);
  if (empty) return empty.index;
  if (slots.length === 1) return slots[0]?.index ?? null;
  return null;
}

function resourceFilename(category: Category, payload: unknown): string {
  const rec = asRecord(payload);
  if (!rec) return "";
  if (category === "ship" && rec.kind === "ship") {
    return (
      asString(asRecord(asRecord(rec.ownership)?.Resource)?.Filename) ?? ""
    );
  }
  return asString(asRecord(rec.Resource)?.Filename) ?? "";
}

export function payloadTypeLabel(category: Category, payload: unknown): string {
  const filename = resourceFilename(category, payload);
  if (category === "ship") return shipTypeFromFilename(filename);
  if (category === "multitool") return multitoolTypeFromFilename(filename);
  if (category === "freighter") return freighterTypeFromFilename(filename);
  return "";
}
