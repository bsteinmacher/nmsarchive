import type { Category } from "@/types/nms";
import {
  basesAdapter,
  deepSpaceAdapter,
  resolveInsertCategory,
  spaceStationAdapter,
} from "./bases";
import { companionsAdapter } from "./companions";
import { exosuitAdapter } from "./exosuit";
import { freightersAdapter } from "./freighters";
import { frigatesAdapter } from "./frigates";
import { multitoolsAdapter } from "./multitools";
import { shipsAdapter } from "./ships";
import type { CategoryAdapter, ExtractedSlot, InsertResult, WriteResult } from "./types";
import { wondersAdapter } from "./wonders";

export {
  listShips,
  listFilledShips,
  isEmptyShipSlot,
  emptySlotLabel,
  shipSeedFromPayload,
  insertShip,
  replaceShip,
  reorderShipOwnership,
  clearShip,
} from "./ships";
export {
  DEEP_SPACE_BASE_TYPE,
  DEEP_SPACE_LABEL,
  FREIGHTER_BASE_LABEL,
  FREIGHTER_BASE_LABEL_ALIASES,
  FREIGHTER_BASE_TYPE,
  SPACE_STATION_BASE_LIMIT,
  SPACE_STATION_BASE_TYPE,
  SPACE_STATION_LABEL,
  isDeepSpaceBaseSlot,
  isFreighterBaseSlot,
  isHiddenFromBasesMenu,
  isSpaceStationBaseSlot,
  listBases,
  listDeepSpaceBases,
  listFreighterBases,
  listSpaceStationBases,
  resolveInsertCategory,
} from "./bases";
export type {
  ExtractedItem,
  ExtractedShip,
  ExtractedSlot,
  CategoryAdapter,
  InsertResult,
  WriteResult,
  AdapterColumn,
} from "./types";

const ADAPTERS = {
  ship: shipsAdapter,
  multitool: multitoolsAdapter,
  companion: companionsAdapter,
  exosuit: exosuitAdapter,
  freighter: freightersAdapter,
  frigate: frigatesAdapter,
  base: basesAdapter,
  deepspace: deepSpaceAdapter,
  spacestation: spaceStationAdapter,
  wonder: wondersAdapter,
} as const satisfies Record<Category, CategoryAdapter>;

export function getAdapter(category: Category): CategoryAdapter {
  return ADAPTERS[category];
}

export function listCategory(
  json: unknown,
  category: Category,
): ExtractedSlot[] {
  return getAdapter(category).list(json);
}

export function listAllCategories(
  json: unknown,
): Record<Category, ExtractedSlot[]> {
  return {
    ship: ADAPTERS.ship.list(json),
    multitool: ADAPTERS.multitool.list(json),
    companion: ADAPTERS.companion.list(json),
    exosuit: ADAPTERS.exosuit.list(json),
    freighter: ADAPTERS.freighter.list(json),
    frigate: ADAPTERS.frigate.list(json),
    base: ADAPTERS.base.list(json),
    deepspace: ADAPTERS.deepspace.list(json),
    spacestation: ADAPTERS.spacestation.list(json),
    wonder: ADAPTERS.wonder.list(json),
  };
}

export function insertItem(
  json: unknown,
  category: Category,
  payload: unknown,
  seed?: string,
): InsertResult {
  const adapter = getAdapter(resolveInsertCategory(category, payload));
  const first = adapter.insert(json, payload);
  if (first.ok) return first;
  if (!seed || !adapter.replace) return first;
  const match = adapter
    .list(json)
    .find(
      (item) =>
        !item.empty &&
        !item.readonly &&
        item.group !== "automatic" &&
        item.seed.toLowerCase() === seed.toLowerCase(),
    );
  if (!match) return first;
  return adapter.replace(json, match.index, payload);
}

export function replaceItem(
  json: unknown,
  category: Category,
  index: number,
  payload: unknown,
): InsertResult {
  const adapter = getAdapter(category);
  if (!adapter.replace) {
    return { ok: false, error: "Esta categoria não substitui slot." };
  }
  return adapter.replace(json, index, payload);
}

export function clearItem(
  json: unknown,
  category: Category,
  index: number,
): InsertResult {
  const adapter = getAdapter(category);
  if (!adapter.clear) {
    return { ok: false, error: "Esta categoria não esvazia slot." };
  }
  return adapter.clear(json, index);
}

export function reorderCategory(
  json: unknown,
  category: Category,
  from: number,
  to: number,
): WriteResult {
  const adapter = getAdapter(category);
  if (!adapter.reorder) {
    return { ok: false, error: "Esta categoria não reordena." };
  }
  return adapter.reorder(json, from, to);
}

export function seedFromPayload(category: Category, payload: unknown): string {
  return getAdapter(category).seedFromPayload(payload);
}
