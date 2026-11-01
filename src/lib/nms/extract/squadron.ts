import { getPlayerState, type SaveContext } from "../player";
import { shipTypeFromFilename } from "../ship-type";
import {
  asArray,
  asRecord,
  asString,
  nameFromFilename,
  normalizeSeed,
} from "../value";
import {
  clonePlayer,
  reorderPlayerArray,
  replaceAtIndex,
} from "./array";
import { emptySlotLabel, nestedEnum } from "./names";
import type { CategoryAdapter, ExtractedSlot, InsertResult } from "./types";

/** O jogo pré-aloca quatro pilotos. O array não cresce. */
export const SQUADRON_LIMIT = 4;

const PILOTS_KEY = "SquadronPilots";
const UNLOCK_KEY = "SquadronUnlockedPilotSlots";

/** 0–3 no JSON do save2.hg. O editor mostra os mesmos nomes. */
const PILOT_RANKS = ["Rookie", "Intermediate", "Veteran", "Ace"] as const;

const SHIP_CLASS_LABEL: Record<string, string> = {
  Fighter: "Fighter",
  Dropship: "Hauler",
  Scientific: "Explorer",
  Shuttle: "Shuttle",
  Royal: "Exotic",
  Alien: "Living Ship",
  Sail: "Solar",
  Robot: "Interceptor",
  Corvette: "Corvette",
};

const ALIEN_RACE_LABEL: Record<string, string> = {
  Warriors: "Vy'keen",
  Explorers: "Korvax",
  Traders: "Gek",
  Robots: "Autophage",
  Diplomats: "Autophage",
};

const RACE_FROM_FILENAME: readonly [marker: string, label: string][] = [
  ["VYKEEN", "Vy'keen"],
  ["KORVAX", "Korvax"],
  ["GEK", "Gek"],
  ["ANOMALY", "Traveller"],
  ["TRAVELLER", "Traveller"],
  ["TRAVELER", "Traveller"],
];

const FULL_ERROR = `Os ${SQUADRON_LIMIT} slots do esquadrão estão ocupados. Esvazie um antes de aplicar outro.`;

function resourceFilename(resource: unknown): string {
  return asString(asRecord(resource)?.Filename) ?? "";
}

export function pilotRankLabel(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value)) {
    return PILOT_RANKS[value] ?? String(value);
  }
  const nested = nestedEnum(value, "PilotRank");
  if (/^\d+$/.test(nested)) {
    const index = Number(nested);
    return PILOT_RANKS[index] ?? nested;
  }
  return nested;
}

function shipClassLabel(value: unknown): string {
  const shipClass =
    nestedEnum(value, "ShipClass") || nestedEnum(value, "SpaceshipClass");
  if (!shipClass) return "";
  return SHIP_CLASS_LABEL[shipClass] ?? shipClass;
}

export function squadronShipType(slot: unknown): string {
  const rec = asRecord(slot);
  if (!rec) return "";
  const fromFile = shipTypeFromFilename(resourceFilename(rec.ShipResource));
  if (fromFile) return fromFile;
  return shipClassLabel(rec.ShipType);
}

export function squadronRace(slot: unknown): string {
  const rec = asRecord(slot);
  if (!rec) return "";
  const alien = nestedEnum(rec.PilotRace, "AlienRace");
  if (alien && alien !== "None") {
    return ALIEN_RACE_LABEL[alien] ?? alien;
  }
  const filename = resourceFilename(rec.NPCResource).toUpperCase();
  for (const [marker, label] of RACE_FROM_FILENAME) {
    if (filename.includes(marker)) return label;
  }
  return "";
}

export function squadronShipSeed(slot: unknown): string {
  const rec = asRecord(slot);
  if (!rec) return "0x0";
  const fromResource = normalizeSeed(asRecord(rec.ShipResource)?.Seed);
  if (fromResource !== "0x0") return fromResource;
  return normalizeSeed(rec.ShipSeed);
}

export function isEmptySquadronSlot(slot: unknown): boolean {
  const rec = asRecord(slot);
  if (!rec) return true;
  const filename = resourceFilename(rec.ShipResource);
  return !filename && squadronShipSeed(rec) === "0x0" && !squadronShipType(rec);
}

function unlockFlags(player: Record<string, unknown>): boolean[] | null {
  const flags = asArray(player[UNLOCK_KEY]);
  if (!flags) return null;
  return flags.map((flag) => flag === true);
}

function setUnlocked(
  player: Record<string, unknown>,
  index: number,
  unlocked: boolean,
  length: number,
) {
  const existing = unlockFlags(player);
  const flags = existing ? [...existing] : Array.from({ length }, () => false);
  while (flags.length < length) flags.push(false);
  if (index >= 0 && index < flags.length) flags[index] = unlocked;
  player[UNLOCK_KEY] = flags;
}

export function unpackSquadronPayload(payload: unknown): {
  pilot: unknown;
  unlocked: boolean;
} {
  const rec = asRecord(payload);
  if (rec?.kind === "squadron") {
    return { pilot: rec.pilot ?? {}, unlocked: rec.unlocked !== false };
  }
  return { pilot: payload, unlocked: true };
}

function packSquadron(pilot: unknown, unlocked: boolean) {
  return { kind: "squadron" as const, pilot, unlocked };
}

function zeroSeed(value: unknown): unknown {
  if (Array.isArray(value)) return [true, "0x0"];
  if (typeof value === "string") return "0x0";
  return value;
}

function blankPilot(slot: unknown): Record<string, unknown> {
  const rec = structuredClone(asRecord(slot) ?? {});
  const ship = asRecord(rec.ShipResource);
  if (ship) rec.ShipResource = { ...ship, Filename: "", Seed: [true, "0x0"] };
  const npc = asRecord(rec.NPCResource);
  if (npc) rec.NPCResource = { ...npc, Filename: "", Seed: [true, "0x0"] };
  if ("TraitsSeed" in rec) rec.TraitsSeed = zeroSeed(rec.TraitsSeed);
  if ("ShipSeed" in rec) rec.ShipSeed = zeroSeed(rec.ShipSeed);
  if ("PilotSeed" in rec) rec.PilotSeed = zeroSeed(rec.PilotSeed);
  if ("Unlocked" in rec) rec.Unlocked = false;
  if ("PilotRank" in rec) {
    rec.PilotRank =
      typeof rec.PilotRank === "number" ? 0 : { PilotRank: "Rookie" };
  }
  return rec;
}

export function listSquadronPilots(
  json: unknown,
  context: SaveContext = "main",
): ExtractedSlot[] {
  const player = getPlayerState(json, context);
  const pilots = asArray(player?.SquadronPilots);
  if (!pilots?.length || !player) return [];
  const flags = unlockFlags(player);

  return pilots.map((slot, index): ExtractedSlot => {
    const rec = asRecord(slot) ?? {};
    const empty = isEmptySquadronSlot(rec);
    const filename = resourceFilename(rec.ShipResource);
    const rank = pilotRankLabel(rec.PilotRank);
    const itemType = squadronShipType(rec);
    const race = squadronRace(rec);
    const unlocked = flags ? flags[index] === true : !empty;
    const seed = empty ? "" : squadronShipSeed(rec);
    return {
      category: "squadron",
      index,
      name: empty
        ? emptySlotLabel(index)
        : nameFromFilename(filename) || `Pilot ${index + 1}`,
      seed,
      className: empty ? "" : rank,
      itemType: empty ? "" : itemType,
      filename: empty ? "" : filename,
      empty,
      slotLabel: String(index + 1),
      extra: {
        ...(rank && !empty ? { rank } : {}),
        ...(itemType && !empty ? { itemType } : {}),
        ...(race && !empty ? { race } : {}),
        unlocked: unlocked ? "true" : "false",
      },
      payload: packSquadron(rec, unlocked),
    };
  });
}

export function insertSquadron(
  mappedJson: unknown,
  payload: unknown,
  context: SaveContext = "main",
): InsertResult {
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const arr = asArray(cloned.player[PILOTS_KEY]);
  if (!arr) {
    return { ok: false, error: "SquadronPilots ausente neste save." };
  }
  const index = arr.findIndex(isEmptySquadronSlot);
  if (index < 0) return { ok: false, error: FULL_ERROR };
  const { pilot, unlocked } = unpackSquadronPayload(payload);
  arr[index] = structuredClone(pilot);
  setUnlocked(cloned.player, index, unlocked, arr.length);
  return { ok: true, json: cloned.json, index };
}

export function replaceSquadron(
  mappedJson: unknown,
  index: number,
  payload: unknown,
  context: SaveContext = "main",
): InsertResult {
  const { pilot, unlocked } = unpackSquadronPayload(payload);
  const replaced = replaceAtIndex(mappedJson, PILOTS_KEY, index, pilot, context);
  if (!replaced.ok) return replaced;
  const cloned = clonePlayer(replaced.json, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const arr = asArray(cloned.player[PILOTS_KEY]);
  if (!arr) return replaced;
  setUnlocked(cloned.player, index, unlocked, arr.length);
  return { ok: true, json: cloned.json, index };
}

export function clearSquadron(
  mappedJson: unknown,
  index: number,
  context: SaveContext = "main",
): InsertResult {
  const cloned = clonePlayer(mappedJson, context);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const arr = asArray(cloned.player[PILOTS_KEY]);
  if (!arr) {
    return { ok: false, error: "SquadronPilots ausente neste save." };
  }
  if (!Number.isInteger(index) || index < 0 || index >= arr.length) {
    return { ok: false, error: "Índice de slot fora do array." };
  }
  const template = arr.find((slot, i) => i !== index && isEmptySquadronSlot(slot));
  arr[index] = structuredClone(template ?? blankPilot(arr[index]));
  setUnlocked(cloned.player, index, false, arr.length);
  return { ok: true, json: cloned.json, index };
}

export const squadronAdapter: CategoryAdapter = {
  category: "squadron",
  label: "Squadron",
  columns: [
    { id: "className", header: "Rank" },
    { id: "itemType", header: "Type" },
    { id: "race", header: "Race" },
    { id: "seed", header: "Seed" },
  ],
  list: listSquadronPilots,
  insert: insertSquadron,
  replace: replaceSquadron,
  clear: clearSquadron,
  reorder: (json, from, to, context) =>
    reorderPlayerArray(json, PILOTS_KEY, from, to, [UNLOCK_KEY], [], context),
  summarize(payload) {
    const { pilot, unlocked } = unpackSquadronPayload(payload);
    const listed = listSquadronPilots({
      BaseContext: {
        PlayerStateData: {
          SquadronPilots: [pilot],
          SquadronUnlockedPilotSlots: [unlocked],
        },
      },
    })[0];
    return {
      name: listed?.empty ? "Pilot" : (listed?.name ?? "Pilot"),
      seed: listed?.seed || squadronShipSeed(pilot),
      extra: listed?.extra ?? {},
    };
  },
  seedFromPayload(payload) {
    return squadronShipSeed(unpackSquadronPayload(payload).pilot);
  },
  missingMessage:
    "Este save não tem SquadronPilots. A categoria fica indisponível.",
};
