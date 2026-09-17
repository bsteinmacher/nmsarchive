import { describe, expect, it } from "vitest";
import {
  buildNmsItem,
  NMSITEM_SCHEMA_VERSION,
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
    expect(round.nmsitem).toBe(NMSITEM_SCHEMA_VERSION);
    expect(NMSITEM_SCHEMA_VERSION).toBe(1);
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
    expect(shipSeedMismatch(item)).toMatch(/payload/);
  });

  it("rejeita JSON sem envelope", () => {
    expect(() => parseNmsItem('{"name":"x"}')).toThrow(/schema/);
  });

  it("aceita category deepspace e spacestation no envelope", () => {
    const deep = buildNmsItem({
      category: "deepspace",
      name: "Orbital",
      seed: "0x10",
      gameVersion: 6785,
      payload: { BaseType: { PersistentBaseTypes: "PlayerSpaceBase" } },
    });
    expect(parseNmsItem(serializeNmsItem(deep)).category).toBe("deepspace");
    const station = buildNmsItem({
      category: "spacestation",
      name: "Estação",
      seed: "0x20",
      gameVersion: 6785,
      payload: {
        BaseType: { PersistentBaseTypes: "PlayerSpaceStationBase" },
      },
    });
    expect(parseNmsItem(serializeNmsItem(station)).category).toBe(
      "spacestation",
    );
  });
});
