import { describe, expect, it } from "vitest";
import {
  buildNmsItem,
  parseNmsItem,
  serializeNmsItem,
  shipSeedMismatch,
} from "@/lib/nmsitem";

const payload = {
  Name: "Golden Vector",
  Resource: {
    Filename: "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTER_PROC.SCENE.MBIN",
    Seed: [true, "0xABC"],
  },
};

describe(".nmsitem", () => {
  it("serializa e parseia o envelope", () => {
    const item = buildNmsItem({
      category: "ship",
      name: "Golden Vector",
      seed: "0xABC",
      gameVersion: 6783,
      payload,
      galaxy: 0,
    });
    const round = parseNmsItem(serializeNmsItem(item));
    expect(round.nmsitem).toBe(1);
    expect(round.seed).toBe("0xabc");
    expect(round.category).toBe("ship");
    expect(shipSeedMismatch(round)).toBeNull();
  });

  it("detecta mismatch de seed da nave", () => {
    const item = buildNmsItem({
      category: "ship",
      name: "X",
      seed: "0x1",
      gameVersion: 1,
      payload,
    });
    expect(shipSeedMismatch(item)).toMatch(/Resource.Seed/);
  });

  it("rejeita JSON sem envelope", () => {
    expect(() => parseNmsItem('{"name":"x"}')).toThrow(/schema/);
  });
});
