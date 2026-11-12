import { freighterTypeFromFilename } from "../freighter-type";
import { getPlayerState, type SaveContext } from "../player";
import {
  asArray,
  asRecord,
  asString,
  nameFromFilename,
  normalizeSeed,
} from "../value";
import {
  FREIGHTER_MERGE,
  mergeApply,
  mergeApplyParts,
  mergeGrid,
  mergeGridParts,
  stripGridCargo,
  stripSpecGrids,
  type ApplyDepth,
  type ApplyParts,
} from "./apply-depth";
import { clonePlayer, inventoryClass } from "./array";
import type { CategoryAdapter, ExtractedSlot, InsertResult } from "./types";

function resourceFilename(resource: unknown): string {
  return asString(asRecord(resource)?.Filename) ?? "";
}

export function isEmptyFreighterResource(resource: unknown): boolean {
  return !resourceFilename(resource);
}

export type CurrentFreighterPayload = {
  kind: "current";
  Resource: unknown;
  Inventory: unknown;
  Inventory_TechOnly: unknown;
  Inventory_Cargo: unknown;
  PlayerFreighterName?: unknown;
  FreighterLayout?: unknown;
  FreighterCargoLayout?: unknown;
  CurrentFreighterHomeSystemSeed?: unknown;
  FreighterUniverseAddress?: unknown;
};

function isCurrentPayload(payload: unknown): payload is CurrentFreighterPayload {
  const rec = asRecord(payload);
  return rec?.kind === "current" && "Resource" in (rec ?? {});
}

function isFleetPayload(payload: unknown): boolean {
  const rec = asRecord(payload);
  return Boolean(rec && ("HomeSystemSeed" in rec || rec.kind === "fleet"));
}

export function currentFreighterPayload(
  player: Record<string, unknown>,
): CurrentFreighterPayload {
  return {
    kind: "current",
    Resource: player.CurrentFreighter,
    Inventory: player.FreighterInventory,
    Inventory_TechOnly: player.FreighterInventory_TechOnly,
    Inventory_Cargo: player.FreighterInventory_Cargo,
    PlayerFreighterName: player.PlayerFreighterName,
    FreighterLayout: player.FreighterLayout,
    FreighterCargoLayout: player.FreighterCargoLayout,
    CurrentFreighterHomeSystemSeed: player.CurrentFreighterHomeSystemSeed,
    FreighterUniverseAddress: player.FreighterUniverseAddress,
  };
}

export function listFreighters(
  json: unknown,
  context: SaveContext = "main",
): ExtractedSlot[] {
  const player = getPlayerState(json, context);
  if (!player) return [];
  const currentResource = player.CurrentFreighter;
  const hasCurrentKey = "CurrentFreighter" in player;
  if (!hasCurrentKey && !Array.isArray(player.FreighterFleet)) return [];

  const items: ExtractedSlot[] = [];
  const currentEmpty = isEmptyFreighterResource(currentResource);
  const filename = resourceFilename(currentResource);
  const itemType = freighterTypeFromFilename(filename);
  const className = inventoryClass(player.FreighterInventory);
  const seed = normalizeSeed(asRecord(currentResource)?.Seed);
  const name =
    asString(player.PlayerFreighterName)?.trim() ||
    asString(asRecord(player.FreighterInventory)?.Name)?.trim() ||
    (filename ? nameFromFilename(filename) : "Empty current Freighter");
  items.push({
    category: "freighter",
    index: 0,
    name: currentEmpty ? "Empty current Freighter" : name,
    seed: currentEmpty ? "" : seed,
    className: currentEmpty ? "" : className,
    itemType: currentEmpty ? "" : itemType,
    filename,
    empty: currentEmpty,
    slotLabel: "Atual",
    extra: currentEmpty
      ? {}
      : { class: className, itemType, filename, role: "current" },
    payload: currentFreighterPayload(player),
  });

  const fleet = asArray(player.FreighterFleet) ?? [];
  fleet.forEach((slot, fleetIndex) => {
    const rec = asRecord(slot) ?? {};
    const resource = rec.Resource;
    const empty = isEmptyFreighterResource(resource);
    const fn = resourceFilename(resource);
    const type = freighterTypeFromFilename(fn);
    const cls = inventoryClass(rec.Inventory);
    const fleetSeed = normalizeSeed(asRecord(resource)?.Seed);
    const fleetName =
      asString(asRecord(rec.Inventory)?.Name)?.trim() ||
      (fn ? nameFromFilename(fn) : "Slot vazio");
    items.push({
      category: "freighter",
      index: fleetIndex + 1,
      name: empty ? "Slot vazio" : fleetName,
      seed: empty ? "" : fleetSeed,
      className: empty ? "" : cls,
      itemType: empty ? "" : type,
      filename: fn,
      empty,
      slotLabel: `Frota ${fleetIndex + 1}`,
      extra: empty
        ? { role: "fleet" }
        : { class: cls, itemType: type, filename: fn, role: "fleet" },
      payload: rec,
    });
  });

  return items;
}

function applyCurrent(
  mappedJson: unknown,
  payload: CurrentFreighterPayload,
  context: SaveContext = "main",
): InsertResult {
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  cloned.player.CurrentFreighter = structuredClone(payload.Resource);
  cloned.player.FreighterInventory = stripGridCargo(payload.Inventory);
  cloned.player.FreighterInventory_TechOnly = stripGridCargo(
    payload.Inventory_TechOnly,
  );
  cloned.player.FreighterInventory_Cargo = stripGridCargo(
    payload.Inventory_Cargo,
  );
  if ("PlayerFreighterName" in payload) {
    cloned.player.PlayerFreighterName = structuredClone(
      payload.PlayerFreighterName,
    );
  }
  if ("FreighterLayout" in payload) {
    cloned.player.FreighterLayout = structuredClone(payload.FreighterLayout);
  }
  if ("FreighterCargoLayout" in payload) {
    cloned.player.FreighterCargoLayout = structuredClone(
      payload.FreighterCargoLayout,
    );
  }
  if ("CurrentFreighterHomeSystemSeed" in payload) {
    cloned.player.CurrentFreighterHomeSystemSeed = structuredClone(
      payload.CurrentFreighterHomeSystemSeed,
    );
  }
  if ("FreighterUniverseAddress" in payload) {
    cloned.player.FreighterUniverseAddress = structuredClone(
      payload.FreighterUniverseAddress,
    );
  }
  return { ok: true, json: cloned.json, index: 0 };
}

const FREIGHTER_GRIDS = [
  ["FreighterInventory", "Inventory"],
  ["FreighterInventory_TechOnly", "Inventory_TechOnly"],
  ["FreighterInventory_Cargo", "Inventory_Cargo"],
] as const;

const FLEET_GRID_KEYS = [
  "Inventory",
  "Inventory_TechOnly",
  "Inventory_Cargo",
] as const;

/** Nome da grade vem da origem; slots do destino ficam. */
function withGridName(grid: unknown, sourceGrid: unknown): unknown {
  const source = asRecord(sourceGrid);
  const dest = asRecord(grid);
  if (!source || !dest || !("Name" in source)) return grid;
  return { ...dest, Name: structuredClone(source.Name) };
}

function copyFleetGridNames(
  dest: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const next = dest;
  for (const key of FLEET_GRID_KEYS) {
    if (!(key in next)) continue;
    next[key] = withGridName(next[key], source[key]);
  }
  return next;
}

function applyCurrentParts(
  mappedJson: unknown,
  payload: CurrentFreighterPayload,
  parts: ApplyParts,
  context: SaveContext,
): InsertResult {
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  if (parts.model) {
    cloned.player.CurrentFreighter = structuredClone(payload.Resource);
  }
  if (parts.name && "PlayerFreighterName" in payload) {
    cloned.player.PlayerFreighterName = structuredClone(payload.PlayerFreighterName);
  }
  if (parts.origin) {
    if ("CurrentFreighterHomeSystemSeed" in payload) {
      cloned.player.CurrentFreighterHomeSystemSeed = structuredClone(
        payload.CurrentFreighterHomeSystemSeed,
      );
    }
    if ("FreighterUniverseAddress" in payload) {
      cloned.player.FreighterUniverseAddress = structuredClone(
        payload.FreighterUniverseAddress,
      );
    }
  }
  if (parts.slots) {
    if ("FreighterLayout" in payload) {
      cloned.player.FreighterLayout = structuredClone(payload.FreighterLayout);
    }
    if ("FreighterCargoLayout" in payload) {
      cloned.player.FreighterCargoLayout = structuredClone(
        payload.FreighterCargoLayout,
      );
    }
  }
  for (const [playerKey, payloadKey] of FREIGHTER_GRIDS) {
    const source = payload[payloadKey];
    if (source == null && cloned.player[playerKey] == null) continue;
    cloned.player[playerKey] = mergeGridParts(
      cloned.player[playerKey],
      source,
      parts,
    );
  }
  return { ok: true, json: cloned.json, index: 0 };
}

function applyCurrentMerged(
  mappedJson: unknown,
  payload: CurrentFreighterPayload,
  depth: ApplyDepth,
  context: SaveContext,
  parts?: ApplyParts,
): InsertResult {
  if (depth === "model" && parts) {
    return applyCurrentParts(mappedJson, payload, parts, context);
  }
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  cloned.player.CurrentFreighter = structuredClone(payload.Resource);
  if (depth === "tech") {
    if ("FreighterLayout" in payload) {
      cloned.player.FreighterLayout = structuredClone(payload.FreighterLayout);
    }
    if ("FreighterCargoLayout" in payload) {
      cloned.player.FreighterCargoLayout = structuredClone(
        payload.FreighterCargoLayout,
      );
    }
  } else {
    if ("PlayerFreighterName" in payload) {
      cloned.player.PlayerFreighterName = structuredClone(
        payload.PlayerFreighterName,
      );
    }
    if ("CurrentFreighterHomeSystemSeed" in payload) {
      cloned.player.CurrentFreighterHomeSystemSeed = structuredClone(
        payload.CurrentFreighterHomeSystemSeed,
      );
    }
    if ("FreighterUniverseAddress" in payload) {
      cloned.player.FreighterUniverseAddress = structuredClone(
        payload.FreighterUniverseAddress,
      );
    }
  }
  for (const [playerKey, payloadKey] of FREIGHTER_GRIDS) {
    const source = payload[payloadKey];
    if (source == null && cloned.player[playerKey] == null) continue;
    const merged = mergeGrid(cloned.player[playerKey], source, depth);
    cloned.player[playerKey] =
      depth === "model" ? withGridName(merged, source) : merged;
  }
  return { ok: true, json: cloned.json, index: 0 };
}

function fleetBody(payload: unknown): Record<string, unknown> | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  const rest = { ...rec };
  delete rest.kind;
  return rest;
}

export function applyFreighter(
  mappedJson: unknown,
  index: number,
  payload: unknown,
  depth: ApplyDepth = "model",
  context: SaveContext = "main",
  parts?: ApplyParts,
): InsertResult {
  if (index === 0 || isCurrentPayload(payload)) {
    if (!isCurrentPayload(payload) || index !== 0) {
      return {
        ok: false,
        error: isCurrentPayload(payload)
          ? "Esta cargueira é a atual e só entra no slot Atual."
          : "Esta cargueira é da frota e não entra no slot Atual.",
      };
    }
    return applyCurrentMerged(mappedJson, payload, depth, context, parts);
  }
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const fleet = asArray(cloned.player.FreighterFleet);
  if (!fleet) {
    return { ok: false, error: "FreighterFleet ausente neste save." };
  }
  const fleetIndex = index - 1;
  if (fleetIndex < 0 || fleetIndex >= fleet.length) {
    return { ok: false, error: "Índice de slot fora da frota." };
  }
  const source = fleetBody(payload);
  if (!source) return { ok: false, error: "Payload de cargueira inválido." };
  const empty = isEmptyFreighterResource(asRecord(fleet[fleetIndex])?.Resource);
  const merged = empty
    ? stripSpecGrids(structuredClone(source), FREIGHTER_MERGE)
    : depth === "model" && parts
      ? mergeApplyParts(fleet[fleetIndex], source, FREIGHTER_MERGE, parts, {
          originKeys: ["HomeSystemSeed"],
        })
      : mergeApply(fleet[fleetIndex], source, depth, FREIGHTER_MERGE);
  fleet[fleetIndex] =
    !empty && depth === "model" && !parts
      ? copyFleetGridNames(merged, source)
      : merged;
  return { ok: true, json: cloned.json, index };
}

export function insertFreighter(
  mappedJson: unknown,
  payload: unknown,
  context: SaveContext = "main",
): InsertResult {
  if (isCurrentPayload(payload)) {
    return applyCurrent(mappedJson, payload, context);
  }
  if (!isFleetPayload(payload)) {
    return {
      ok: false,
      error: "Payload de cargueira sem kind current/fleet.",
    };
  }
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const fleet = asArray(cloned.player.FreighterFleet);
  if (!fleet) {
    return { ok: false, error: "FreighterFleet ausente neste save." };
  }
  const fleetIndex = fleet.findIndex((slot) => {
    const rec = asRecord(slot);
    return isEmptyFreighterResource(rec?.Resource);
  });
  if (fleetIndex < 0) {
    return {
      ok: false,
      error:
        "Não há slot vazio na frota de cargueiras. O arquivo não expande FreighterFleet.",
    };
  }
  const rec = asRecord(payload) ?? {};
  const { kind: _kind, ...rest } = rec;
  fleet[fleetIndex] = stripSpecGrids(structuredClone(rest), FREIGHTER_MERGE);
  return { ok: true, json: cloned.json, index: fleetIndex + 1 };
}

export function replaceFreighter(
  mappedJson: unknown,
  index: number,
  payload: unknown,
  context: SaveContext = "main",
): InsertResult {
  if (index === 0 || isCurrentPayload(payload)) {
    if (!isCurrentPayload(payload)) {
      return { ok: false, error: "Slot atual exige payload kind=current." };
    }
    return applyCurrent(mappedJson, payload, context);
  }
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const fleet = asArray(cloned.player.FreighterFleet);
  if (!fleet) {
    return { ok: false, error: "FreighterFleet ausente neste save." };
  }
  const fleetIndex = index - 1;
  if (fleetIndex < 0 || fleetIndex >= fleet.length) {
    return { ok: false, error: "Índice de slot fora da frota." };
  }
  const rec = asRecord(payload) ?? {};
  const { kind: _kind, ...rest } = rec;
  fleet[fleetIndex] = structuredClone(rest);
  return { ok: true, json: cloned.json, index };
}

export function clearFreighter(
  mappedJson: unknown,
  index: number,
  context: SaveContext = "main",
): InsertResult {
  if (index === 0) {
    return {
      ok: false,
      error: "A cargueira atual não pode ser esvaziada por aqui.",
    };
  }
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const fleet = asArray(cloned.player.FreighterFleet);
  if (!fleet) {
    return { ok: false, error: "FreighterFleet ausente neste save." };
  }
  const fleetIndex = index - 1;
  if (fleetIndex < 0 || fleetIndex >= fleet.length) {
    return { ok: false, error: "Índice de slot fora da frota." };
  }
  const template = fleet.find((slot, i) => {
    if (i === fleetIndex) return false;
    return isEmptyFreighterResource(asRecord(slot)?.Resource);
  });
  fleet[fleetIndex] = structuredClone(
    template ?? { Resource: { Filename: "", Seed: [false, "0x0"] } },
  );
  return { ok: true, json: cloned.json, index };
}

export function freighterSeedFromPayload(payload: unknown): string {
  const rec = asRecord(payload);
  if (!rec) return "0x0";
  if (rec.kind === "current") {
    return normalizeSeed(asRecord(rec.Resource)?.Seed);
  }
  return normalizeSeed(asRecord(rec.Resource)?.Seed);
}

export const freightersAdapter: CategoryAdapter = {
  category: "freighter",
  label: "Freighters",
  columns: [
    { id: "className", header: "Class" },
    { id: "itemType", header: "Type" },
    { id: "seed", header: "Seed" },
  ],
  list: listFreighters,
  insert: insertFreighter,
  replace: replaceFreighter,
  clear: clearFreighter,
  summarize(payload) {
    const rec = asRecord(payload);
    if (isCurrentPayload(payload)) {
      const filename = resourceFilename(payload.Resource);
      const name =
        asString(payload.PlayerFreighterName)?.trim() ||
        nameFromFilename(filename) ||
        "Freighter";
      return {
        name,
        seed: freighterSeedFromPayload(payload),
        extra: { role: "current", itemType: freighterTypeFromFilename(filename) },
      };
    }
    const filename = resourceFilename(rec?.Resource);
    return {
      name: nameFromFilename(filename) || "Fleet Freighter",
      seed: freighterSeedFromPayload(payload),
      extra: { role: "fleet", itemType: freighterTypeFromFilename(filename) },
    };
  },
  seedFromPayload: freighterSeedFromPayload,
  missingMessage:
    "Este save não tem CurrentFreighter. A categoria fica indisponível.",
};
