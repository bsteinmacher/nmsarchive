import { getPlayerState } from "../player";
import { asNumber, asRecord } from "../value";
import { clonePlayer } from "./array";
import {
  applyLayoutGrid,
  countSpecialSlots,
  countTechSlots,
  countValidSlots,
  extractLayoutGrid,
  gridSizeLabel,
} from "./inventory-layout";
import type { CategoryAdapter, ExtractedSlot, InsertResult } from "./types";

export type ExosuitLayoutPayload = {
  Inventory: Record<string, unknown>;
  Inventory_TechOnly: Record<string, unknown>;
  Inventory_Cargo: Record<string, unknown>;
};

function isLayoutPayload(payload: unknown): payload is ExosuitLayoutPayload {
  const rec = asRecord(payload);
  return Boolean(rec && asRecord(rec.Inventory) && asRecord(rec.Inventory_TechOnly));
}

export function extractExosuitLayout(json: unknown): ExosuitLayoutPayload | null {
  const player = getPlayerState(json);
  if (!player) return null;
  if (!asRecord(player.Inventory) && !asRecord(player.Inventory_TechOnly)) {
    return null;
  }
  return {
    Inventory: extractLayoutGrid(player.Inventory, true),
    Inventory_TechOnly: extractLayoutGrid(player.Inventory_TechOnly, true),
    Inventory_Cargo: extractLayoutGrid(player.Inventory_Cargo, true),
  };
}

export function listExosuit(json: unknown): ExtractedSlot<ExosuitLayoutPayload>[] {
  const payload = extractExosuitLayout(json);
  if (!payload) return [];
  const general = payload.Inventory;
  const tech = payload.Inventory_TechOnly;
  const cargo = payload.Inventory_Cargo;
  const valid =
    countValidSlots(general) + countValidSlots(tech) + countValidSlots(cargo);
  const techCount =
    countTechSlots(general) +
    (Array.isArray(tech.Slots) ? tech.Slots.length : 0) +
    countTechSlots(cargo);
  const supercharged =
    countSpecialSlots(general) +
    countSpecialSlots(tech) +
    countSpecialSlots(cargo);
  const size = [gridSizeLabel(general), gridSizeLabel(tech)]
    .filter(Boolean)
    .join(" / ");
  return [
    {
      category: "exosuit",
      index: 0,
      name: "Exosuit layout",
      seed: "0x0",
      className: "",
      itemType: "layout",
      filename: "",
      empty: false,
      slotLabel: "Exosuit",
      extra: {
        slots: String(valid),
        tech: String(techCount),
        supercharged: String(supercharged),
        size,
      },
      payload,
    },
  ];
}

export function insertExosuit(
  mappedJson: unknown,
  payload: unknown,
): InsertResult {
  if (!isLayoutPayload(payload)) {
    return { ok: false, error: "Payload de traje inválido (faltam os grids)." };
  }
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const general = asRecord(cloned.player.Inventory);
  const tech = asRecord(cloned.player.Inventory_TechOnly);
  const cargo = asRecord(cloned.player.Inventory_Cargo);
  if (!general || !tech) {
    return {
      ok: false,
      error: "Inventário do traje ausente neste save.",
    };
  }
  applyLayoutGrid(general, payload.Inventory);
  applyLayoutGrid(tech, payload.Inventory_TechOnly);
  if (cargo) applyLayoutGrid(cargo, payload.Inventory_Cargo);
  return { ok: true, json: cloned.json, index: 0 };
}

export const exosuitAdapter: CategoryAdapter<ExosuitLayoutPayload> = {
  category: "exosuit",
  label: "Exosuit",
  columns: [
    { id: "slots", header: "Slots" },
    { id: "tech", header: "Tech" },
    { id: "supercharged", header: "Supercharged" },
  ],
  list: listExosuit,
  insert: insertExosuit,
  replace: (json, _index, payload) => insertExosuit(json, payload),
  summarize(payload) {
    const listed = listExosuit({
      BaseContext: {
        PlayerStateData: {
          Inventory: payload.Inventory,
          Inventory_TechOnly: payload.Inventory_TechOnly,
          Inventory_Cargo: payload.Inventory_Cargo,
        },
      },
    })[0];
    return {
      name: listed?.name ?? "Exosuit layout",
      seed: "0x0",
      extra: listed?.extra ?? {},
    };
  },
  seedFromPayload: () => "0x0",
  missingMessage:
    "Este save não tem os grids do traje. A categoria fica indisponível.",
};

export function exosuitHasSubstanceSlots(payload: unknown): boolean {
  if (!isLayoutPayload(payload)) return false;
  const grids = [
    payload.Inventory,
    payload.Inventory_TechOnly,
    payload.Inventory_Cargo,
  ];
  for (const grid of grids) {
    const slots = Array.isArray(grid.Slots) ? grid.Slots : [];
    for (const slot of slots) {
      const type = asRecord(asRecord(slot)?.Type)?.InventoryType;
      if (type === "Substance" || type === "Product") return true;
    }
  }
  return false;
}

/** Largura numérica para testes; evita import circular com value. */
export function gridWidth(grid: unknown): number {
  return asNumber(asRecord(grid)?.Width) ?? 0;
}
