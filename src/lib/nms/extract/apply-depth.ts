import type { Category } from "@/types/nms";
import { freighterTypeFromFilename } from "../freighter-type";
import { multitoolTypeFromFilename } from "../multitool-type";
import { shipTypeFromFilename } from "../ship-type";
import { asRecord, asString } from "../value";
import { isTechSlot } from "./inventory-layout";
import type { ExtractedSlot } from "./types";

/** Quanto do item arquivado entra no slot destino. */
export const APPLY_DEPTHS = ["model", "supercharged", "tech", "full"] as const;

export type ApplyDepth = (typeof APPLY_DEPTHS)[number];

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

export function usesApplyDepth(
  category: string,
): category is "ship" | "multitool" | "freighter" {
  return (
    category === "ship" || category === "multitool" || category === "freighter"
  );
}

const TECH_LAYOUT_KEYS = [
  "ValidSlotIndices",
  "Width",
  "Height",
  "StackSizeGroup",
  "IsCool",
  "Version",
  "NumSlotsFromTech",
  "BaseStatValues",
] as const;

export type ApplyMergeSpec = {
  visual: readonly string[];
  grids: readonly string[];
  /** Campos do destino que permanecem, inclusive no conteúdo completo. */
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
  visual: ["Resource", "Seed"],
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

function indexKey(slot: unknown): string | null {
  const index = asRecord(asRecord(slot)?.Index);
  if (!index) return null;
  const x = index.X;
  const y = index.Y;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return `${x}:${y}`;
}

export function mergeGrid(
  destGrid: unknown,
  sourceGrid: unknown,
  depth: ApplyDepth,
): unknown {
  const source = asRecord(sourceGrid);
  if (!source) return destGrid;
  if (depth === "full") {
    const next = structuredClone(source);
    const dest = asRecord(destGrid);
    if (dest && "Name" in dest) next.Name = structuredClone(dest.Name);
    return next;
  }

  const dest = structuredClone(asRecord(destGrid) ?? {});
  copyInventoryClass(dest, source);
  if (depth === "model") return dest;

  if ("SpecialSlots" in source) {
    dest.SpecialSlots = structuredClone(source.SpecialSlots);
  }
  if (depth === "supercharged") return dest;

  for (const key of TECH_LAYOUT_KEYS) {
    if (key in source) dest[key] = structuredClone(source[key]);
  }
  const sourceSlots = Array.isArray(source.Slots) ? source.Slots : [];
  const incomingTech = sourceSlots.filter(isTechSlot);
  const taken = new Set(
    incomingTech.map(indexKey).filter((key): key is string => key != null),
  );
  const kept = (Array.isArray(dest.Slots) ? dest.Slots : []).filter((slot) => {
    if (isTechSlot(slot)) return false;
    const key = indexKey(slot);
    return key == null || !taken.has(key);
  });
  dest.Slots = [...kept, ...structuredClone(incomingTech)];
  return dest;
}

export function mergeApply(
  dest: unknown,
  source: Record<string, unknown>,
  depth: ApplyDepth,
  spec: ApplyMergeSpec,
): Record<string, unknown> {
  const destRec = asRecord(dest) ?? {};
  if (depth === "full") {
    const next = structuredClone(source);
    for (const key of spec.keep) {
      if (key in destRec) next[key] = structuredClone(destRec[key]);
    }
    for (const gridKey of spec.grids) {
      if (!(gridKey in source)) continue;
      next[gridKey] = mergeGrid(destRec[gridKey], source[gridKey], "full");
    }
    return next;
  }

  const next = structuredClone(destRec);
  for (const key of spec.visual) {
    if (key in source) next[key] = structuredClone(source[key]);
  }
  if (
    spec.layoutKey &&
    depth !== "model" &&
    spec.layoutKey in source
  ) {
    next[spec.layoutKey] = structuredClone(source[spec.layoutKey]);
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
  payload: unknown,
): ExtractedSlot[] {
  const usable = slots.filter(
    (slot) => !slot.readonly && slot.group !== "automatic",
  );
  if (category !== "freighter") return usable;
  const kind = asString(asRecord(payload)?.kind);
  if (kind === "current") return usable.filter((slot) => slot.index === 0);
  return usable.filter((slot) => slot.index !== 0);
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
