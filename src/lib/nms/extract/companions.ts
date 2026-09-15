import { getPlayerState } from "../player";
import { remapSlotIndex, reorderSlots } from "../reorder";
import { asArray, asNumber, asRecord, asString, normalizeSeed } from "../value";
import { clonePlayer, insertAtFirstEmpty, replaceAtIndex } from "./array";
import { biomeLabel, displayId } from "./names";
import { emptySlotLabel } from "./names";
import type {
  CategoryAdapter,
  ExtractedSlot,
  InsertResult,
  WriteResult,
} from "./types";

export function isEmptyCompanionSlot(slot: unknown): boolean {
  const rec = asRecord(slot);
  return !displayId(rec?.CreatureID);
}

export function companionSeedFromPayload(payload: unknown): string {
  const rec = asRecord(payload);
  return normalizeSeed(rec?.CreatureSeed);
}

function companionName(rec: Record<string, unknown>): string {
  const custom = asString(rec.CustomName)?.trim();
  if (custom) return custom;
  const species = displayId(rec.CustomSpeciesName);
  if (species) return species;
  const id = displayId(rec.CreatureID);
  return id || "Companion";
}

export function listCompanions(json: unknown): ExtractedSlot[] {
  const player = getPlayerState(json);
  const pets = player?.Pets;
  if (!Array.isArray(pets)) return [];

  return pets.map((slot, index): ExtractedSlot => {
    const rec = asRecord(slot) ?? {};
    if (isEmptyCompanionSlot(slot)) {
      return {
        category: "companion",
        index,
        name: emptySlotLabel(index),
        seed: "",
        className: "",
        itemType: "",
        filename: "",
        empty: true,
        extra: {},
        payload: rec,
      };
    }
    const itemType = displayId(rec.CreatureID);
    const biome = biomeLabel(rec.Biome);
    const descriptors = asArray(rec.Descriptors) ?? [];
    const seed = companionSeedFromPayload(rec);
    return {
      category: "companion",
      index,
      name: companionName(rec),
      seed,
      className: "",
      itemType,
      filename: "",
      empty: false,
      extra: {
        biome,
        species: itemType,
        descriptors: String(descriptors.length),
      },
      payload: rec,
    };
  });
}

function remapPetBattleTeam(
  team: unknown,
  from: number,
  to: number,
  length: number,
): unknown {
  const rec = asRecord(team);
  if (!rec) return team;
  const members = asArray(rec.TeamMembers);
  if (!members) return team;
  return {
    ...rec,
    TeamMembers: members.map((member) => {
      const row = asRecord(member);
      if (!row) return member;
      const index = asNumber(row.PetIndex);
      if (index == null || index < 0 || index >= length) return member;
      return { ...row, PetIndex: remapSlotIndex(index, from, to) };
    }),
  };
}

export function reorderCompanions(
  mappedJson: unknown,
  from: number,
  to: number,
): WriteResult {
  const cloned = clonePlayer(mappedJson);
  if ("error" in cloned) return { ok: false, error: cloned.error };
  const pets = asArray(cloned.player.Pets);
  if (!pets) {
    return { ok: false, error: "Pets ausente neste save." };
  }
  try {
    cloned.player.Pets = reorderSlots(pets, from, to);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não foi possível reordenar.",
    };
  }
  const length = pets.length;
  const unlocked = asArray(cloned.player.UnlockedPetSlots);
  if (unlocked && unlocked.length === length) {
    cloned.player.UnlockedPetSlots = reorderSlots(unlocked, from, to);
  }
  const accessories = asArray(cloned.player.PetAccessoryCustomisation);
  if (accessories && accessories.length === length) {
    cloned.player.PetAccessoryCustomisation = reorderSlots(
      accessories,
      from,
      to,
    );
  }
  cloned.player.PetBattleTeam = remapPetBattleTeam(
    cloned.player.PetBattleTeam,
    from,
    to,
    length,
  );
  return { ok: true, json: cloned.json };
}

const EMPTY_PET =
  "Não há slot vazio de companion. O jogo limita o array; o arquivo não expande Pets.";

export function insertCompanion(
  json: unknown,
  payload: unknown,
): InsertResult {
  return insertAtFirstEmpty(
    json,
    "Pets",
    payload,
    isEmptyCompanionSlot,
    EMPTY_PET,
  );
}

export const companionsAdapter: CategoryAdapter = {
  category: "companion",
  label: "Companions",
  columns: [
    { id: "itemType", header: "Espécie" },
    { id: "biome", header: "Biome" },
    { id: "seed", header: "Seed" },
  ],
  list: listCompanions,
  insert: insertCompanion,
  replace: (json, index, payload) =>
    replaceAtIndex(json, "Pets", index, payload),
  reorder: reorderCompanions,
  summarize(payload) {
    const listed = listCompanions({
      BaseContext: { PlayerStateData: { Pets: [payload] } },
    })[0];
    return {
      name: listed?.empty ? "Companion" : (listed?.name ?? "Companion"),
      seed: listed?.seed || companionSeedFromPayload(payload),
      extra: listed?.extra ?? {},
    };
  },
  seedFromPayload: companionSeedFromPayload,
  missingMessage:
    "Este save não tem Pets. A categoria fica indisponível até o jogo criar os slots.",
};
