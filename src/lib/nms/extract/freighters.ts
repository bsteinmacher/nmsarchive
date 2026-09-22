import { freighterTypeFromFilename } from "../freighter-type";
import { getPlayerState } from "../player";
import {
  asArray,
  asRecord,
  asString,
  nameFromFilename,
  normalizeSeed,
} from "../value";
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

export function listFreighters(json: unknown): ExtractedSlot[] {
  const player = getPlayerState(json);
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
      extra: empty ? {} : { class: cls, itemType: type, filename: fn, role: "fleet" },
      payload: rec,
    });
  });

  return items;
}

function applyCurrent(
  mappedJson: unknown,
  payload: CurrentFreighterPayload,
): InsertResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  cloned.player.CurrentFreighter = structuredClone(payload.Resource);
  cloned.player.FreighterInventory = structuredClone(payload.Inventory);
  cloned.player.FreighterInventory_TechOnly = structuredClone(
    payload.Inventory_TechOnly,
  );
  cloned.player.FreighterInventory_Cargo = structuredClone(
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

export function insertFreighter(
  mappedJson: unknown,
  payload: unknown,
): InsertResult {
  if (isCurrentPayload(payload)) {
    return applyCurrent(mappedJson, payload);
  }
  if (!isFleetPayload(payload)) {
    return {
      ok: false,
      error: "Payload de cargueira sem kind current/fleet.",
    };
  }
  const cloned = clonePlayer(mappedJson);
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
  fleet[fleetIndex] = structuredClone(rest);
  return { ok: true, json: cloned.json, index: fleetIndex + 1 };
}

export function replaceFreighter(
  mappedJson: unknown,
  index: number,
  payload: unknown,
): InsertResult {
  if (index === 0 || isCurrentPayload(payload)) {
    if (!isCurrentPayload(payload)) {
      return { ok: false, error: "Slot atual exige payload kind=current." };
    }
    return applyCurrent(mappedJson, payload);
  }
  const cloned = clonePlayer(mappedJson);
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
): InsertResult {
  if (index === 0) {
    return {
      ok: false,
      error: "A cargueira atual não pode ser esvaziada por aqui.",
    };
  }
  const cloned = clonePlayer(mappedJson);
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
