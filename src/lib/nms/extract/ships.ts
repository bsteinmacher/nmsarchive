import { getPlayerState } from "../player";
import { remapSlotIndex, reorderSlots, shipCustomisationIndex } from "../reorder";
import { shipTypeFromFilename } from "../ship-type";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  nameFromFilename,
  normalizeSeed,
} from "../value";
import { clonePlayer, inventoryClass } from "./array";
import { basePersistentType } from "./bases";
import { emptySlotLabel } from "./names";
import type {
  CategoryAdapter,
  ExtractedShip,
  InsertResult,
  WriteResult,
} from "./types";

const PLAYER_SHIP_BASE = "PlayerShipBase";

/** Customização vazia: evita herdar visual de outra nave no mesmo slot (GoatFungus #981). */
export const EMPTY_SHIP_CUSTOMISATION = {
  SelectedPreset: "^",
  CustomData: {
    DescriptorGroups: [] as unknown[],
    FCx: "^",
    Colours: [] as unknown[],
    TextureOptions: [] as unknown[],
    BoneScales: [] as unknown[],
    Scale: 1.0,
  },
};

export type PackedShipPayload = {
  kind: "ship";
  ownership: Record<string, unknown>;
  customisation?: unknown;
  hull?: unknown;
};

export function isPackedShipPayload(
  payload: unknown,
): payload is PackedShipPayload {
  const rec = asRecord(payload);
  return rec?.kind === "ship" && asRecord(rec.ownership) != null;
}

export function unpackShipOwnership(payload: unknown): Record<string, unknown> {
  if (isPackedShipPayload(payload)) {
    return asRecord(payload.ownership) ?? {};
  }
  return asRecord(payload) ?? {};
}

function customisationHasVisual(entry: unknown): boolean {
  const rec = asRecord(entry);
  const data = asRecord(rec?.CustomData);
  if (!data) return false;
  return (
    (asArray(data.DescriptorGroups)?.length ?? 0) > 0 ||
    (asArray(data.Colours)?.length ?? 0) > 0 ||
    (asArray(data.TextureOptions)?.length ?? 0) > 0
  );
}

function playerShipHullAt(
  player: Record<string, unknown>,
  index: number,
): unknown {
  const bases = asArray(player.PersistentPlayerBases) ?? [];
  return (
    bases.find((slot) => {
      if (basePersistentType(slot) !== PLAYER_SHIP_BASE) return false;
      return asNumber(asRecord(slot)?.UserData) === index;
    }) ?? null
  );
}

export function packShipPayload(
  player: Record<string, unknown>,
  ownership: Record<string, unknown>,
  index: number,
): PackedShipPayload {
  const packed: PackedShipPayload = {
    kind: "ship",
    ownership: structuredClone(ownership),
  };
  const ccdIndex = shipCustomisationIndex(index);
  const ccd = asArray(player.CharacterCustomisationData);
  if (ccd && ccdIndex != null && ccdIndex < ccd.length) {
    const entry = ccd[ccdIndex];
    if (customisationHasVisual(entry)) {
      packed.customisation = structuredClone(entry);
    }
  }
  const hull = playerShipHullAt(player, index);
  if (hull) packed.hull = structuredClone(hull);
  return packed;
}

function applyShipVisuals(
  player: Record<string, unknown>,
  destIndex: number,
  customisation: unknown | undefined,
  hull: unknown | undefined,
) {
  const ccdIndex = shipCustomisationIndex(destIndex);
  const ccd = asArray(player.CharacterCustomisationData);
  if (ccd && ccdIndex != null && ccdIndex < ccd.length) {
    ccd[ccdIndex] = structuredClone(
      customisation ?? EMPTY_SHIP_CUSTOMISATION,
    );
  }

  const bases = asArray(player.PersistentPlayerBases);
  if (!bases) return;

  const kept = bases.filter((slot) => {
    if (basePersistentType(slot) !== PLAYER_SHIP_BASE) return true;
    return asNumber(asRecord(slot)?.UserData) !== destIndex;
  });
  if (hull) {
    const cloned = structuredClone(asRecord(hull) ?? hull);
    const rec = asRecord(cloned);
    if (rec) rec.UserData = destIndex;
    kept.push(cloned);
  }
  player.PersistentPlayerBases = kept;
}

export function isEmptyShipSlot(slot: unknown): boolean {
  const rec = asRecord(slot);
  const resource = asRecord(rec?.Resource);
  const filename = asString(resource?.Filename);
  return !filename;
}

export { emptySlotLabel } from "./names";

export function listShips(json: unknown): ExtractedShip[] {
  const player = getPlayerState(json);
  const ships = player?.ShipOwnership;
  if (!Array.isArray(ships) || !player) return [];

  return ships.map((slot, index): ExtractedShip => {
    const rec = asRecord(slot) ?? {};
    if (isEmptyShipSlot(slot)) {
      return {
        category: "ship",
        index,
        name: emptySlotLabel(index),
        seed: "",
        className: "",
        filename: "",
        shipType: "",
        itemType: "",
        empty: true,
        extra: {},
        payload: rec,
      };
    }
    const resource = asRecord(rec.Resource) ?? {};
    const filename = asString(resource.Filename) ?? "";
    const className = inventoryClass(rec.Inventory);
    const rawName = asString(rec.Name) ?? "";
    const name = rawName || nameFromFilename(filename);
    const seed = normalizeSeed(resource.Seed);
    const shipType = shipTypeFromFilename(filename);
    return {
      category: "ship",
      index,
      name,
      seed,
      className,
      filename,
      shipType,
      itemType: shipType,
      empty: false,
      extra: { class: className, filename, shipType },
      payload: packShipPayload(player, rec, index),
    };
  });
}

export function listFilledShips(json: unknown): ExtractedShip[] {
  return listShips(json).filter((ship) => !ship.empty);
}

export function shipSeedFromPayload(payload: unknown): string {
  const ownership = unpackShipOwnership(payload);
  const resource = asRecord(ownership.Resource);
  return normalizeSeed(resource?.Seed);
}

export function insertShip(mappedJson: unknown, payload: unknown): InsertResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const ships = asArray(cloned.player.ShipOwnership);
  if (!ships) {
    return { ok: false, error: "ShipOwnership ausente neste save." };
  }
  const packed = isPackedShipPayload(payload);
  const ownership = unpackShipOwnership(payload);
  const index = ships.findIndex(isEmptyShipSlot);
  if (index < 0) {
    return {
      ok: false,
      error:
        "Não há slot vazio de nave. O jogo limita o array; o arquivo não expande ShipOwnership.",
    };
  }
  ships[index] = structuredClone(ownership);
  applyShipVisuals(
    cloned.player,
    index,
    packed ? payload.customisation : undefined,
    packed ? payload.hull : undefined,
  );
  return { ok: true, index, json: cloned.json };
}

export const EMPTY_SHIP_OWNERSHIP = {
  Name: "",
  Resource: { Filename: "", Seed: [false, "0x0"] as [boolean, string] },
};

export function clearShip(mappedJson: unknown, index: number): InsertResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const ships = asArray(cloned.player.ShipOwnership);
  if (!ships) {
    return { ok: false, error: "ShipOwnership ausente neste save." };
  }
  if (!Number.isInteger(index) || index < 0 || index >= ships.length) {
    return { ok: false, error: "Índice de slot fora do array." };
  }
  const template = ships.find(
    (slot, i) => i !== index && isEmptyShipSlot(slot),
  );
  ships[index] = structuredClone(template ?? EMPTY_SHIP_OWNERSHIP);
  applyShipVisuals(cloned.player, index, undefined, undefined);
  const legacy = asArray(cloned.player.ShipUsesLegacyColours);
  if (legacy && index < legacy.length) legacy[index] = false;
  for (const key of SHIP_INDEX_KEYS) {
    if (asNumber(cloned.player[key]) !== index) continue;
    const next = ships.findIndex(
      (slot, i) => i !== index && !isEmptyShipSlot(slot),
    );
    cloned.player[key] = next >= 0 ? next : 0;
  }
  return { ok: true, index, json: cloned.json };
}

export function replaceShip(
  mappedJson: unknown,
  index: number,
  payload: unknown,
): InsertResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const ships = asArray(cloned.player.ShipOwnership);
  if (!ships) {
    return { ok: false, error: "ShipOwnership ausente neste save." };
  }
  if (!Number.isInteger(index) || index < 0 || index >= ships.length) {
    return { ok: false, error: "Índice de slot fora do array." };
  }
  const packed = isPackedShipPayload(payload);
  const ownership = unpackShipOwnership(payload);
  ships[index] = structuredClone(ownership);
  applyShipVisuals(
    cloned.player,
    index,
    packed ? payload.customisation : undefined,
    packed ? payload.hull : undefined,
  );
  return { ok: true, index, json: cloned.json };
}

const SHIP_INDEX_KEYS = ["PrimaryShip", "CorvetteEditAssociatedShipIndex"] as const;

/**
 * O casco da Corvette não fica em ShipOwnership: é um PersistentPlayerBase
 * PlayerShipBase cujo UserData é o índice 0-based do slot. Sem este remap,
 * inventário/tech da nave andam e o casco (e os módulos CV_) ficam no slot velho.
 */
function remapPlayerShipBaseUserData(
  player: Record<string, unknown>,
  from: number,
  to: number,
  shipCount: number,
) {
  const bases = asArray(player.PersistentPlayerBases);
  if (!bases) return;
  for (const slot of bases) {
    if (basePersistentType(slot) !== PLAYER_SHIP_BASE) continue;
    const rec = asRecord(slot);
    if (!rec) continue;
    const current = asNumber(rec.UserData);
    if (current == null) continue;
    if (current < 0 || current >= shipCount) continue;
    rec.UserData = remapSlotIndex(current, from, to);
  }
}

function swapShipCustomisationData(
  player: Record<string, unknown>,
  from: number,
  to: number,
) {
  const fromIdx = shipCustomisationIndex(from);
  const toIdx = shipCustomisationIndex(to);
  if (fromIdx == null || toIdx == null || fromIdx === toIdx) return;
  const ccd = asArray(player.CharacterCustomisationData);
  if (!ccd || fromIdx >= ccd.length || toIdx >= ccd.length) return;
  const tmp = ccd[fromIdx];
  ccd[fromIdx] = ccd[toIdx];
  ccd[toIdx] = tmp;
}

export function reorderShipOwnership(
  mappedJson: unknown,
  from: number,
  to: number,
): WriteResult {
  const json = structuredClone(mappedJson);
  const player = getPlayerState(json);
  if (!player) {
    return { ok: false, error: "PlayerStateData ausente neste save." };
  }
  const ships = asArray(player.ShipOwnership);
  if (!ships) {
    return { ok: false, error: "ShipOwnership ausente neste save." };
  }
  try {
    player.ShipOwnership = reorderSlots(ships, from, to);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não foi possível reordenar.",
    };
  }
  const length = ships.length;
  const legacy = asArray(player.ShipUsesLegacyColours);
  if (legacy && legacy.length === length) {
    player.ShipUsesLegacyColours = reorderSlots(legacy, from, to);
  }
  for (const key of SHIP_INDEX_KEYS) {
    const current = asNumber(player[key]);
    if (current == null) continue;
    if (current < 0 || current >= length) continue;
    player[key] = remapSlotIndex(current, from, to);
  }
  remapPlayerShipBaseUserData(player, from, to, length);
  swapShipCustomisationData(player, from, to);
  return { ok: true, json };
}

export const shipsAdapter: CategoryAdapter = {
  category: "ship",
  label: "Ships",
  columns: [
    { id: "className", header: "Class" },
    { id: "itemType", header: "Ship Type" },
    { id: "seed", header: "Seed" },
  ],
  list: listShips,
  insert: insertShip,
  replace: replaceShip,
  clear: clearShip,
  reorder: reorderShipOwnership,
  summarize(payload) {
    const ownership = unpackShipOwnership(payload);
    const listed = listShips({
      BaseContext: { PlayerStateData: { ShipOwnership: [ownership] } },
    })[0];
    return {
      name: listed?.empty ? "Ship" : (listed?.name ?? "Ship"),
      seed: listed?.seed || shipSeedFromPayload(payload),
      extra: listed?.extra ?? {},
    };
  },
  seedFromPayload: shipSeedFromPayload,
  missingMessage:
    "Este save não tem ShipOwnership. A categoria fica indisponível até o jogo criar os slots.",
};
