import { asArray, asNumber, asRecord, asString } from "../value";
import { biomeLabel, displayId, nestedEnum } from "./names";

/**
 * Arena affinity from the origin biome.
 * Mechanical companions (sentinel / MiniRobo) override the biome.
 */
const BIOME_ELEMENT: Record<string, string> = {
  Lush: "Tropical",
  Toxic: "Toxic",
  Scorched: "Fire",
  Radioactive: "Radioactive",
  Frozen: "Ice",
  Barren: "Desert",
  Dead: "Anomalous",
  Weird: "Anomalous",
  Red: "Anomalous",
  Green: "Anomalous",
  Blue: "Anomalous",
  Swamp: "Tropical",
  Lava: "Fire",
  Waterworld: "Tropical",
  GasGiant: "Anomalous",
};

const MECHANICAL_CREATURE_TYPES = new Set([
  "MiniRobo",
  "MiniDrone",
  "Drone",
  "Quad",
  "SpiderQuad",
  "SpiderQuadMini",
  "Walker",
]);

/** Combate / Agilidade / Vida, como no jogo. */
export type CompanionRank = {
  atk: string;
  agi: string;
  hp: string;
};

export type CompanionBattleStats = {
  biome: string;
  element: string;
  level: string;
};

export const COMPANION_RANK_LETTERS = ["S", "A", "B", "C"] as const;

const RANK_LETTERS = new Set<string>(COMPANION_RANK_LETTERS);

export function emptyCompanionRank(): CompanionRank {
  return { atk: "", agi: "", hp: "" };
}

export function formatCompanionRank(rank: CompanionRank): string {
  if (!rank.atk || !rank.agi || !rank.hp) return "";
  return `${rank.atk}/${rank.agi}/${rank.hp}`;
}

export const COMPANION_CLASS_TIERS = [
  "SSS",
  "SS",
  "S",
  "A",
  "B",
  "C",
] as const;

export type CompanionClassTier = (typeof COMPANION_CLASS_TIERS)[number];

/** 3×S → SSS, 2×S → SS, 1×S → S; sem S, a pior letra. */
export function companionClassFromRank(rank: CompanionRank): string {
  if (!rank.atk || !rank.agi || !rank.hp) return "";
  const letters = [rank.atk, rank.agi, rank.hp];
  const sCount = letters.filter((letter) => letter === "S").length;
  if (sCount === 3) return "SSS";
  if (sCount === 2) return "SS";
  if (sCount === 1) return "S";
  if (letters.includes("C")) return "C";
  if (letters.includes("B")) return "B";
  return "A";
}

/** Aceita SSS/SS/S/A/B/C ou o rank antigo S/S/S. */
export function normalizeItemClass(className: string): string {
  const upper = className.trim().toUpperCase().replace(/\s+/g, "");
  if (!upper) return "";
  if (upper.includes("/")) {
    const rank = parseCompanionRank(upper);
    return companionClassFromRank(rank);
  }
  return upper;
}

export function parseCompanionRank(raw: string | null | undefined): CompanionRank {
  const empty = emptyCompanionRank();
  if (!raw) return empty;
  const parts = raw
    .trim()
    .toUpperCase()
    .split("/")
    .map((part) => part.trim());
  if (parts.length !== 3) return empty;
  const [atk, agi, hp] = parts;
  if (!atk || !agi || !hp) return empty;
  if (!RANK_LETTERS.has(atk) || !RANK_LETTERS.has(agi) || !RANK_LETTERS.has(hp)) {
    return empty;
  }
  return { atk, agi, hp };
}

/** Só o rank que a pessoa anotou. Ignora o C/C/C extraído do override morto. */
export function companionRankFromMetadata(input: {
  className?: string | null;
  extra?: Record<string, string> | null;
}): CompanionRank {
  const extra = input.extra ?? {};
  if (extra.rank) return parseCompanionRank(extra.rank);
  const classes = extra.classes?.replace(/\s+/g, "") ?? "";
  if (classes && classes !== "C/C/C") return parseCompanionRank(extra.classes);
  if (input.className?.includes("/")) return parseCompanionRank(input.className);
  return emptyCompanionRank();
}

export function companionRankExtra(
  extra: Record<string, string>,
  rank: CompanionRank,
): Record<string, string> {
  const next = { ...extra };
  delete next.classes;
  delete next.def;
  const formatted = formatCompanionRank(rank);
  if (!formatted) {
    delete next.rank;
    delete next.atk;
    delete next.agi;
    delete next.hp;
    return next;
  }
  next.rank = formatted;
  next.atk = rank.atk;
  next.agi = rank.agi;
  next.hp = rank.hp;
  return next;
}

export function companionElement(
  biome: string,
  creatureType: string,
): string {
  if (MECHANICAL_CREATURE_TYPES.has(creatureType)) return "Mechanical";
  return BIOME_ELEMENT[biome] ?? "";
}

/** Nível de treino: soma dos gene-edits nas três stats (cada uma 0–10). */
export function companionLevel(treatsEaten: unknown): string {
  const treats = asArray(treatsEaten);
  if (!treats?.length) return "";
  let total = 0;
  let any = false;
  for (const value of treats) {
    const n = asNumber(value);
    if (n == null) continue;
    any = true;
    total += n;
  }
  return any ? String(total) : "";
}

export function companionBattleStats(
  rec: Record<string, unknown>,
): CompanionBattleStats {
  const biome = biomeLabel(rec.Biome);
  const creatureType = nestedEnum(rec.CreatureType, "CreatureType");
  return {
    biome,
    element: companionElement(biome, creatureType),
    level: companionLevel(rec.PetBattlerTreatsEaten),
  };
}

/** Extra arquivado, ou o payload se o extra antigo não tiver bioma/elemento. */
export function companionBattleFromArchived(input: {
  extra?: Record<string, unknown> | null;
  payload?: unknown;
}): CompanionBattleStats {
  const extra = input.extra ?? {};
  const rec = asRecord(input.payload);
  const fromPayload = rec
    ? companionBattleStats(rec)
    : { biome: "", element: "", level: "" };
  return {
    biome: fromPayload.biome || asString(extra.biome) || "",
    element: fromPayload.element || asString(extra.element) || "",
    level: fromPayload.level || asString(extra.level) || "",
  };
}

export function companionSpecies(rec: Record<string, unknown>): string {
  return displayId(rec.CreatureID);
}
