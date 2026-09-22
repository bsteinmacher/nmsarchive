import { describe, expect, it } from "vitest";
import {
  archiveUiCategory,
  archivedScreenshotUrl,
  isArchivedDeepSpace,
  isArchivedFreighterBase,
  isArchivedSpaceStation,
  matchingArchivedItems,
  matchingItems,
  matchingShips,
} from "@/lib/archive-match";
import type { ExtractedShip, ExtractedSlot } from "@/lib/nms/extract/types";
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
  it("não trata 0x0 como identidade compartilhada", () => {
    const ships = [
      ship({ index: 0, seed: "0x0" }),
      ship({ index: 1, seed: "0x0" }),
    ];
    expect(matchingShips(ships, "0x0", "ship")).toEqual([]);
  });

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

function companion(
  partial: Partial<ExtractedSlot> & Pick<ExtractedSlot, "index" | "seed">,
): ExtractedSlot {
  return {
    category: "companion",
    name: "Pet",
    extra: {},
    payload: {},
    className: "",
    filename: "",
    itemType: "HOVER_PET",
    empty: false,
    ...partial,
  };
}

describe("matchingItems companions", () => {
  it("casa CreatureSeed antigo só quando ele é único no save", () => {
    const pets = [
      companion({
        index: 0,
        seed: "0xaaa",
        payload: { CreatureSeed: [true, "0xdf23350a15d95e55"] },
      }),
      companion({
        index: 8,
        seed: "0xbbb",
        payload: { CreatureSeed: [true, "0xdf23350a15d95e55"] },
      }),
      companion({
        index: 2,
        seed: "0xccc",
        payload: { CreatureSeed: [true, "0xfeeb82d5970bdec9"] },
      }),
    ];
    expect(
      matchingItems(pets, "0xfeeb82d5970bdec9", "companion").map((p) => p.index),
    ).toEqual([2]);
    expect(
      matchingItems(pets, "0xdf23350a15d95e55", "companion"),
    ).toEqual([]);
  });

  it("casa pelo identitySeed mesmo com CreatureSeed 0x0 ou repetido no envelope", () => {
    const pets = [
      companion({ index: 0, seed: "0xaaa" }),
      companion({ index: 3, seed: "0xbbb" }),
      companion({ index: 6, seed: "0xccc" }),
      companion({ index: 7, seed: "0xddd" }),
      companion({ index: 8, seed: "0xeee" }),
    ];
    expect(
      matchingItems(pets, "0x0", "companion", "0xccc").map((p) => p.index),
    ).toEqual([6]);
    expect(
      matchingItems(pets, "0x0", "companion", "0xddd").map((p) => p.index),
    ).toEqual([7]);
    expect(
      matchingItems(
        pets,
        "0xdf23350a15d95e55",
        "companion",
        "0xaaa",
      ).map((p) => p.index),
    ).toEqual([0]);
    expect(
      matchingItems(
        pets,
        "0xdf23350a15d95e55",
        "companion",
        "0xeee",
      ).map((p) => p.index),
    ).toEqual([8]);
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

  it("casa companion pelo identitySeed quando o envelope é 0x0", () => {
    const slot = companion({ index: 6, seed: "0xccc" });
    const items = [
      archived({
        id: "quad",
        category: "companion",
        seed: "0x0",
        identitySeed: "0xccc",
        screenshotPath: "22222222-2222-2222-2222-222222222222.webp",
      }),
      archived({
        id: "fiend",
        category: "companion",
        seed: "0x0",
        identitySeed: "0xbbb",
      }),
    ];
    expect(matchingArchivedItems(items, slot).map((i) => i.id)).toEqual([
      "quad",
    ]);
  });
});
