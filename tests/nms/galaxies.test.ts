import { describe, expect, it } from "vitest";
import { formatGalaxy, parseGalaxyDisplay } from "@/lib/nms/galaxies";

describe("galaxies", () => {
  it("mostra 1–256 e Euclid como 1, sem somar na hora de gravar", () => {
    expect(formatGalaxy(0)).toBe("1 · Euclid");
    expect(parseGalaxyDisplay(1)).toBe(0);
    expect(formatGalaxy(255)).toBe("256 · Odyalutai");
    expect(parseGalaxyDisplay(256)).toBe(255);
  });

  it("índice sem nome conhecido vira Galáxia {n}", () => {
    expect(formatGalaxy(42)).toBe("Galáxia 43");
  });

  it("rejeita display fora de 1–256", () => {
    expect(() => parseGalaxyDisplay(0)).toThrow(/1–256/);
    expect(() => parseGalaxyDisplay(257)).toThrow(/1–256/);
  });
});
