import { describe, expect, it } from "vitest";
import {
  autoTagsFromArchived,
  autoTagsFromSlot,
  replaceMultitoolTypeTag,
} from "@/lib/auto-tags";
import type { ExtractedSlot } from "@/lib/nms/extract/types";
import type { ArchivedItemSummary } from "@/types/archive";

function slot(
  overrides: Partial<ExtractedSlot> & Pick<ExtractedSlot, "category">,
): ExtractedSlot {
  return {
    index: 0,
    name: "Item",
    seed: "0x1",
    extra: {},
    payload: {},
    empty: false,
    className: "S",
    itemType: "Fighter",
    filename: "",
    ...overrides,
  };
}

function archived(
  overrides: Partial<ArchivedItemSummary> &
    Pick<ArchivedItemSummary, "category">,
): ArchivedItemSummary {
  const now = new Date("2026-01-01");
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Item",
    seed: "0x1",
    description: "desc",
    galaxy: 0,
    coordinates: null,
    gameVersion: 1,
    className: "S",
    shipType: "Fighter",
    filename: "",
    tags: [],
    screenshotPath: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("autoTagsFromSlot", () => {
  it("só coloca galáxia e planeta em bases", () => {
    expect(
      autoTagsFromSlot(
        slot({
          category: "ship",
          extra: { galaxy: "1 · Euclid", planet: "Home" },
        }),
      ),
    ).toEqual(["Fighter", "S"]);
    expect(
      autoTagsFromSlot(
        slot({
          category: "base",
          itemType: "HabitableBase",
          extra: {
            galaxy: "1 · Euclid",
            planet: "Home",
            planetType: "Lush",
          },
        }),
      ),
    ).toEqual(["HabitableBase", "S", "1 · Euclid", "Home", "Lush"]);
  });

  it("usa o tipo da wiki nas multi-tools e ignora Multi-tool genérico", () => {
    expect(
      autoTagsFromSlot(
        slot({
          category: "multitool",
          itemType: "Atlas Staff",
          className: "S",
        }),
      ),
    ).toEqual(["Voltaic Staff", "S"]);
    expect(
      autoTagsFromSlot(
        slot({
          category: "multitool",
          itemType: "Multi-tool",
          className: "A",
        }),
      ),
    ).toEqual(["A"]);
  });

  it("usa element, biome e level em inglês nos companions", () => {
    expect(
      autoTagsFromSlot(
        slot({
          category: "companion",
          itemType: "TREX",
          className: "SSS",
          extra: {
            element: "Toxic",
            biome: "Toxic",
            level: "30",
            galaxy: "1 · Euclid",
          },
        }),
      ),
    ).toEqual(["TREX", "Toxic", "Level 30", "SSS"]);
  });
});

describe("autoTagsFromArchived", () => {
  it("não propaga galaxy do save em naves", () => {
    expect(
      autoTagsFromArchived(
        archived({ category: "ship", galaxy: 0, shipType: "Fighter" }),
      ),
    ).toEqual(["Fighter", "S"]);
  });

  it("troca a tag de tipo da multi-tool", () => {
    expect(replaceMultitoolTypeTag(["Multi-tool", "S"], "Pistol")).toEqual([
      "S",
      "Pistol",
    ]);
    expect(
      replaceMultitoolTypeTag(["Voltaic Staff", "atlas"], "Rifle"),
    ).toEqual(["Rifle"]);
  });

  it("coloca a galáxia só em bases", () => {
    expect(
      autoTagsFromArchived(
        archived({
          category: "base",
          galaxy: 0,
          shipType: "HabitableBase",
          extra: { planet: "Home" },
        }),
      ),
    ).toEqual(["HabitableBase", "S", "1 · Euclid", "Home"]);
  });
});
