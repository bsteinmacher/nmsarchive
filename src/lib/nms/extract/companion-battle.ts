import { asArray, asNumber, asRecord, asString } from "../value";
import { biomeLabel, displayId, nestedEnum } from "./names";

/**
 * Afinidade da arena a partir do bioma de origem.
 * Mecânicos (sentinela / MiniRobo) sobrescrevem o bioma.
 */
const BIOME_ELEMENT: Record<string, string> = {
  Lush: "Tropical",
  Toxic: "Tóxico",
  Scorched: "Fogo",
  Radioactive: "Radioativo",
  Frozen: "Gelo",
  Barren: "Deserto",
  Dead: "Anômalo",
  Weird: "Anômalo",
  Red: "Anômalo",
  Green: "Anômalo",
  Blue: "Anômalo",
  Swamp: "Tropical",
  Lava: "Fogo",
  Waterworld: "Tropical",
  GasGiant: "Anômalo",
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
  if (MECHANICAL_CREATURE_TYPES.has(creatureType)) return "Mecânico";
  return BIOME_ELEMENT[biome] ?? "";
}

/** Nível de treino: o maior gene-edit (0–10 no jogo) nas três stats. */
export function companionLevel(treatsEaten: unknown): string {
  const treats = asArray(treatsEaten);
  if (!treats?.length) return "";
  let max = 0;
  let any = false;
  for (const value of treats) {
    const n = asNumber(value);
    if (n == null) continue;
    any = true;
    max = Math.max(max, n);
  }
  return any ? String(max) : "";
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
    biome: asString(extra.biome) || fromPayload.biome,
    element: asString(extra.element) || fromPayload.element,
    level: asString(extra.level) || fromPayload.level,
  };
}

export function companionSpecies(rec: Record<string, unknown>): string {
  return displayId(rec.CreatureID);
}
