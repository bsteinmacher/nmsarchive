import { describe, expect, it } from "vitest";
import {
  frigateTraitIds,
  sumFrigateStats,
} from "@/lib/nms/extract/frigate-stats";

describe("sumFrigateStats", () => {
  it("soma Combat/Exploration/Mining/Diplomacy e fuel pelos índices fixos", () => {
    const one = {
      Stats: [10, 20, 30, 40, 5, 80],
      TraitIDs: ["^EXPLORE_PRI", "^COMBAT_SEC"],
    };
    const two = {
      Stats: [1, 2, 3, 4, 1, 10],
      TraitIDs: [],
    };
    expect(sumFrigateStats([one, two])).toEqual({
      combat: 11,
      exploration: 22,
      mining: 33,
      diplomacy: 44,
      fuelBurn: 6,
      fuelCapacity: 90,
    });
    expect(frigateTraitIds(one)).toEqual(["EXPLORE_PRI", "COMBAT_SEC"]);
  });
});
