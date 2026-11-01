import type { Category } from "@/types/nms";
import { freighterTypeFromFilename } from "../freighter-type";
import { multitoolTypeFromFilename } from "../multitool-type";
import { shipTypeFromFilename } from "../ship-type";
import { asRecord, asString } from "../value";
import { isTechSlot } from "./inventory-layout";
import type { ExtractedSlot } from "./types";

/** Re-skin = só visual. Trocar = slots + tech, inventário vazio. */
export const APPLY_DEPTHS = ["model", "tech"] as const;

export type ApplyDepth = (typeof APPLY_DEPTHS)[number];

export const APPLY_OVERLAY_MODES = [
  {
    id: "model" as const,
    label: "Re-skin",
    hint: "Só o visual. Slots e tecnologias deste slot ficam.",
  },
  {
    id: "tech" as const,
    label: "Trocar",
    hint: "Slots e tecnologias da origem. Inventário fica vazio.",
  },
] as const;

export type CompanionLevelChoice = "archived" | "zero";

export type ApplyRequest = {
  index?: number;
  depth?: ApplyDepth;
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
  visual: ["Resource"],
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
