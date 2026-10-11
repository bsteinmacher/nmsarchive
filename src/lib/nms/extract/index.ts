import type { SaveContext } from "../player";
import type { Category } from "@/types/nms";
import {
  zeroCompanionTreats,
  type ApplyRequest,
} from "./apply-depth";
import {
  basesAdapter,
  deepSpaceAdapter,
  resolveInsertCategory,
  spaceStationAdapter,
} from "./bases";
import { companionsAdapter } from "./companions";
import { exosuitAdapter } from "./exosuit";
import { applyFreighter, freightersAdapter } from "./freighters";
import { frigatesAdapter } from "./frigates";
import { applyMultitool, multitoolsAdapter } from "./multitools";
import { applyShip, shipsAdapter } from "./ships";
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
export { FLEET_FRIGATE_LIMIT } from "./frigates";
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
  context: SaveContext = "main",
): ExtractedSlot[] {
  return getAdapter(category).list(json, context);
}

export function listAllCategories(
  json: unknown,
  context: SaveContext = "main",
): Record<Category, ExtractedSlot[]> {
  return {
    ship: ADAPTERS.ship.list(json, context),
    multitool: ADAPTERS.multitool.list(json, context),
    companion: ADAPTERS.companion.list(json, context),
    exosuit: ADAPTERS.exosuit.list(json, context),
    freighter: ADAPTERS.freighter.list(json, context),
    frigate: ADAPTERS.frigate.list(json, context),
    base: ADAPTERS.base.list(json, context),
    deepspace: ADAPTERS.deepspace.list(json, context),
    spacestation: ADAPTERS.spacestation.list(json, context),
    wonder: ADAPTERS.wonder.list(json, context),
  };
}

export function insertItem(
  json: unknown,
  category: Category,
  payload: unknown,
  seed?: string,
  context: SaveContext = "main",
): InsertResult {
  const adapter = getAdapter(resolveInsertCategory(category, payload));
  const first = adapter.insert(json, payload, context);
  if (first.ok) return first;
  if (!adapter.replace) return first;
  const needles = new Set(
    [seed, adapter.seedFromPayload(payload)]
      .map((value) => value?.toLowerCase())
      .filter((value): value is string => Boolean(value) && value !== "0x0"),
  );
  if (needles.size === 0) return first;
  const match = adapter
    .list(json, context)
    .find(
      (item) =>
        !item.empty &&
        !item.readonly &&
        item.group !== "automatic" &&
        needles.has(item.seed.toLowerCase()),
    );
  if (!match) return first;
  return adapter.replace(json, match.index, payload, context);
}

export function applyItem(
  json: unknown,
  category: Category,
  payload: unknown,
  seed?: string,
  context: SaveContext = "main",
  request?: ApplyRequest,
): InsertResult {
  const depth = request?.depth ?? "full";
  const index = request?.index;

  if (category === "companion") {
    const body =
      request?.companionLevel === "zero"
        ? zeroCompanionTreats(payload)
        : payload;
    if (index == null) return insertItem(json, category, body, seed, context);
    return replaceItem(json, category, index, body, context);
  }

  if (category === "ship" || category === "multitool" || category === "freighter") {
    if (index == null) {
      if (depth === "full") return insertItem(json, category, payload, seed, context);
      return { ok: false, error: "Escolha o slot destino." };
    }
    if (category === "ship") return applyShip(json, index, payload, depth, context);
    if (category === "multitool") {
      return applyMultitool(json, index, payload, depth, context);
    }
    return applyFreighter(json, index, payload, depth, context);
  }

  return insertItem(json, category, payload, seed, context);
}

export function replaceItem(
  json: unknown,
  category: Category,
  index: number,
  payload: unknown,
  context: SaveContext = "main",
): InsertResult {
  const adapter = getAdapter(category);
  if (!adapter.replace) {
    return { ok: false, error: "Esta categoria não substitui slot." };
  }
  return adapter.replace(json, index, payload, context);
}

export function clearItem(
  json: unknown,
  category: Category,
  index: number,
  context: SaveContext = "main",
): InsertResult {
  const adapter = getAdapter(category);
  if (!adapter.clear) {
    return { ok: false, error: "Esta categoria não esvazia slot." };
  }
  return adapter.clear(json, index, context);
}

export function reorderCategory(
  json: unknown,
  category: Category,
  from: number,
  to: number,
  context: SaveContext = "main",
): WriteResult {
  const adapter = getAdapter(category);
  if (!adapter.reorder) {
    return { ok: false, error: "Esta categoria não reordena." };
  }
  return adapter.reorder(json, from, to, context);
}

export function seedFromPayload(category: Category, payload: unknown): string {
  return getAdapter(category).seedFromPayload(payload);
}
