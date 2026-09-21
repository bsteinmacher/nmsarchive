import { describe, expect, it } from "vitest";
import {
  archiveUiCategory,
  archivedScreenshotUrl,
  isArchivedDeepSpace,
  isArchivedFreighterBase,
  isArchivedSpaceStation,
  matchingArchivedItems,
  matchingShips,
} from "@/lib/archive-match";
import type { ExtractedShip } from "@/lib/nms/extract/types";
import type { ArchivedItemSummary } from "@/types/archive";

function ship(partial: Partial<ExtractedShip> & Pick<ExtractedShip, "index" | "seed">): ExtractedShip {
  return {
    category: "ship",
    name: "X",
    extra: {},
    payload: {},
    className: "S",
    filename: "FIGHTER_PROC",
    shipType: "Fighter",
    itemType: "Fighter",
    empty: false,
    ...partial,
  };
}

describe("matchingShips", () => {
  it("acha o mesmo seed+category e ignora vazio", () => {
    const ships = [
      ship({ index: 0, seed: "0xabc", empty: true, name: "Slot 1 vazio" }),
      ship({ index: 1, seed: "0xABC" }),
      ship({ index: 2, seed: "0xdef" }),
    ];
    const hits = matchingShips(ships, "0xabc", "ship");
    expect(hits.map((s) => s.index)).toEqual([1]);
  });
});

describe("archiveUiCategory", () => {
  it("trata FreighterBase como Freighter no arquivo", () => {
    expect(
      isArchivedFreighterBase({
        category: "base",
        shipType: "Freighter",
        extra: { baseType: "FreighterBase" },
      }),
    ).toBe(true);
    expect(
      archiveUiCategory({
        category: "base",
        extra: { baseType: "FreighterBase" },
      }),
    ).toBe("freighter");
    expect(
      isArchivedFreighterBase({
        category: "base",
        shipType: "Cargueira",
      }),
    ).toBe(true);
    expect(
      isArchivedFreighterBase({
        category: "base",
        shipType: "Planet",
      }),
    ).toBe(false);
    expect(archiveUiCategory({ category: "base", shipType: "Planet" })).toBe(
      "base",
    );
  });

  it("trata PlayerSpaceBase / PlayerSpaceStationBase nos menus COSMOS", () => {
    expect(
      isArchivedDeepSpace({
        category: "base",
        extra: { baseType: "PlayerSpaceBase" },
      }),
    ).toBe(true);
    expect(
      archiveUiCategory({
        category: "base",
        extra: { baseType: "PlayerSpaceBase" },
      }),
    ).toBe("deepspace");
    expect(
      isArchivedSpaceStation({
        category: "base",
        shipType: "PlayerSpaceStationBase",
      }),
    ).toBe(true);
    expect(
      archiveUiCategory({
        category: "base",
        extra: { baseType: "PlayerSpaceStationBase" },
      }),
    ).toBe("spacestation");
    expect(archiveUiCategory({ category: "deepspace" })).toBe("deepspace");
    expect(archiveUiCategory({ category: "spacestation" })).toBe(
      "spacestation",
    );
  });
});

describe("matchingArchivedItems", () => {
  const now = new Date("2026-01-01");
  function archived(
    partial: Partial<ArchivedItemSummary> & Pick<ArchivedItemSummary, "id" | "seed">,
  ): ArchivedItemSummary {
    return {
      category: "ship",
      name: "X",
      description: "",
      galaxy: null,
      coordinates: null,
      gameVersion: null,
      className: "S",
      shipType: "Fighter",
      filename: "",
      tags: [],
      screenshotPath: null,
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
  }

  it("reusa a screenshot do arquivo com o mesmo seed", () => {
    const slot = ship({ index: 1, seed: "0xabc" });
    const items = [
      archived({
        id: "a",
        seed: "0xABC",
        screenshotPath: "11111111-1111-1111-1111-111111111111.webp",
      }),
      archived({ id: "b", seed: "0xdef" }),
    ];
    expect(matchingArchivedItems(items, slot).map((i) => i.id)).toEqual(["a"]);
    expect(archivedScreenshotUrl(items, slot)).toBe(
      "/api/screenshots/11111111-1111-1111-1111-111111111111",
    );
  });

  it("deixa sem imagem quando o seed não está no arquivo", () => {
    const slot = ship({ index: 1, seed: "0xabc" });
    expect(archivedScreenshotUrl([], slot)).toBeNull();
  });
});
