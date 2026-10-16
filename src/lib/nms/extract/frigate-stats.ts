import { asArray, asNumber, asRecord } from "../value";
import { displayId } from "./names";

/** Índices de `FleetFrigates[].Stats` (GcFrigateStatType). */
export const FRIGATE_STAT_INDEX = {
  combat: 0,
  exploration: 1,
  mining: 2,
  diplomacy: 3,
  fuelBurn: 4,
  fuelCapacity: 5,
} as const;

export type FrigateStatTotals = {
  combat: number;
  exploration: number;
  mining: number;
  diplomacy: number;
  fuelBurn: number;
  fuelCapacity: number;
};

export function frigateStatsFromPayload(payload: unknown): number[] {
  const rec = asRecord(payload);
  const stats = asArray(rec?.Stats) ?? [];
  return stats.map((value) => asNumber(value) ?? 0);
}

export function frigateTraitIds(payload: unknown): string[] {
  const rec = asRecord(payload);
  const ids = asArray(rec?.TraitIDs) ?? [];
  return ids.map((id) => displayId(id)).filter(Boolean);
}

export function emptyFrigateTotals(): FrigateStatTotals {
  return {
    combat: 0,
    exploration: 0,
    mining: 0,
    diplomacy: 0,
    fuelBurn: 0,
    fuelCapacity: 0,
  };
}

export function sumFrigateStats(payloads: unknown[]): FrigateStatTotals {
  const totals = emptyFrigateTotals();
  for (const payload of payloads) {
    const stats = frigateStatsFromPayload(payload);
    totals.combat += stats[FRIGATE_STAT_INDEX.combat] ?? 0;
    totals.exploration += stats[FRIGATE_STAT_INDEX.exploration] ?? 0;
    totals.mining += stats[FRIGATE_STAT_INDEX.mining] ?? 0;
    totals.diplomacy += stats[FRIGATE_STAT_INDEX.diplomacy] ?? 0;
    totals.fuelBurn += stats[FRIGATE_STAT_INDEX.fuelBurn] ?? 0;
    totals.fuelCapacity += stats[FRIGATE_STAT_INDEX.fuelCapacity] ?? 0;
  }
  return totals;
}
