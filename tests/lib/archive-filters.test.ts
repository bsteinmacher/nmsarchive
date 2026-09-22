import { describe, expect, it } from "vitest";
import {
  hasActiveArchiveFilters,
  matchesArchiveFilters,
} from "@/lib/archive-filters";

const exoticS = {
  name: "Golden Vector",
  description: "Exotic de Euclid",
  seed: "0xabc",
  className: "S",
  shipType: "Exotic",
  galaxy: 0,
  tags: [{ slug: "exotic" }, { slug: "s-class" }],
};

const fighterA = {
  name: "Horizon",
  description: "Fighter comum",
  seed: "0xdef",
  className: "A",
  shipType: "Fighter",
  galaxy: 255,
  tags: [{ slug: "fighter" }],
};

describe("matchesArchiveFilters", () => {
  it("filtra S-class + tag exotic", () => {
    const filters = { className: "S", tags: ["exotic"] };
    expect(matchesArchiveFilters(exoticS, filters)).toBe(true);
    expect(matchesArchiveFilters(fighterA, filters)).toBe(false);
    expect(
      matchesArchiveFilters(
        { ...exoticS, tags: [{ slug: "s-class" }] },
        filters,
      ),
    ).toBe(false);
  });

  it("filtra tipo, galáxia 0–255 e texto em nome/descrição", () => {
    expect(
      matchesArchiveFilters(fighterA, { itemType: "fighter", galaxy: 255 }),
    ).toBe(true);
    expect(matchesArchiveFilters(fighterA, { galaxy: 0 })).toBe(false);
    expect(matchesArchiveFilters(exoticS, { q: "golden" })).toBe(true);
    expect(matchesArchiveFilters(exoticS, { q: "euclid" })).toBe(true);
    expect(matchesArchiveFilters(exoticS, { q: "hauler" })).toBe(false);
    expect(matchesArchiveFilters(exoticS, { seed: "0xABC" })).toBe(true);
    expect(
      matchesArchiveFilters(
        { ...exoticS, extra: { element: "Gelo", biome: "Frozen" } },
        { q: "gelo" },
      ),
    ).toBe(true);
  });

  it("detecta filtros ativos", () => {
    expect(hasActiveArchiveFilters({})).toBe(false);
    expect(hasActiveArchiveFilters({ className: "S" })).toBe(true);
  });
});
