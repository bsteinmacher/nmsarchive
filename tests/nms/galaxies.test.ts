import { describe, expect, it } from "vitest";
import {
  formatGalaxy,
  GALAXY_COUNT,
  GALAXY_NAMES,
  galaxyName,
  parseGalaxyDisplay,
} from "@/lib/nms/galaxies";

describe("galaxies", () => {
  it("lista as 256 galáxias, Euclid = 1 e Odyalutai = 256", () => {
    expect(GALAXY_NAMES).toHaveLength(GALAXY_COUNT);
    expect(new Set(GALAXY_NAMES).size).toBe(GALAXY_COUNT);
    expect(formatGalaxy(0)).toBe("1 · Euclid");
    expect(parseGalaxyDisplay(1)).toBe(0);
    expect(formatGalaxy(9)).toBe("10 · Eissentam");
    expect(formatGalaxy(42)).toBe("43 · Oniijialdu");
    expect(formatGalaxy(255)).toBe("256 · Odyalutai");
    expect(parseGalaxyDisplay(256)).toBe(255);
  });

  it("índice fora de 0–255 vira Galáxia {n}", () => {
    expect(galaxyName(-1)).toBeUndefined();
    expect(galaxyName(256)).toBeUndefined();
    expect(formatGalaxy(256)).toBe("Galáxia 257");
  });

  it("rejeita display fora de 1–256", () => {
    expect(() => parseGalaxyDisplay(0)).toThrow(/1–256/);
    expect(() => parseGalaxyDisplay(257)).toThrow(/1–256/);
  });
});
