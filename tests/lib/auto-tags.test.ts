import { describe, expect, it } from "vitest";
import {
  alignAutoTags,
  autoTagsFromArchived,
  autoTagsFromSlot,
  replaceClassTag,
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
    notes: "",
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
    ).toEqual(["S Class", "Fighter", "Ship"]);
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

  it("coloca classe, tipo e Multi-tool nas multi-tools", () => {
    expect(
      autoTagsFromSlot(
        slot({
          category: "multitool",
          itemType: "Atlas Staff",
          className: "S",
        }),
      ),
    ).toEqual(["S Class", "Voltaic Staff", "Multi-tool"]);
    expect(
      autoTagsFromSlot(
        slot({
          category: "multitool",
          itemType: "Multi-tool",
          className: "A",
        }),
      ),
    ).toEqual(["A Class", "Multi-tool"]);
  });

  it("ordena companions: classe, elemento, tipo, level e bioma", () => {
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
    ).toEqual(["SSS Class", "Toxic", "TREX", "Level 30", "Toxic Biome"]);
  });

  it("squadron leva rank, tipo, categoria e raça, sem o flag de liberado", () => {
    expect(
      autoTagsFromSlot(
        slot({
          category: "squadron",
          className: "Ace",
          itemType: "Exotic",
          extra: { rank: "Ace", race: "Vy'keen", unlocked: "true" },
        }),
      ),
    ).toEqual(["Ace", "Exotic", "Squadron", "Vy'keen"]);
  });

  it("usa a mesma ordem em freighter e frigate", () => {
    expect(
      autoTagsFromSlot(
        slot({
          category: "freighter",
          itemType: "Pirate",
          className: "S",
        }),
      ),
    ).toEqual(["S Class", "Pirate", "Freighter"]);
    expect(
      autoTagsFromSlot(
        slot({
          category: "frigate",
          itemType: "Ghost",
          className: "S",
          extra: { traits: "2" },
        }),
      ),
    ).toEqual(["S Class", "Ghost", "Frigate", "2"]);
  });
});

describe("autoTagsFromArchived", () => {
  it("não propaga galaxy do save em naves", () => {
    expect(
      autoTagsFromArchived(
        archived({ category: "ship", galaxy: 0, shipType: "Fighter" }),
      ),
    ).toEqual(["S Class", "Fighter", "Ship"]);
  });

  it("troca a tag de tipo da multi-tool e mantém Multi-tool", () => {
    expect(replaceMultitoolTypeTag(["Multi-tool", "S"], "Pistol")).toEqual([
      "S",
      "Pistol",
      "Multi-tool",
    ]);
    expect(
      replaceMultitoolTypeTag(["Voltaic Staff", "atlas"], "Rifle"),
    ).toEqual(["Rifle"]);
    expect(
      replaceMultitoolTypeTag(
        ["A Class", "Experimental", "Multi-tool", "Twitch"],
        "Rifle",
      ),
    ).toEqual(["A Class", "Rifle", "Multi-tool", "Twitch"]);
  });

  it("formata a classe e deixa as tags manuais depois", () => {
    expect(replaceClassTag(["Ice", "B", "Twitch"], "SSS")).toEqual([
      "SSS Class",
      "Ice",
      "Twitch",
    ]);
    expect(
      alignAutoTags(
        ["A", "Twitch", "Explorer", "Original"],
        ["A Class", "Explorer", "Ship"],
      ),
    ).toEqual(["A Class", "Explorer", "Ship", "Twitch", "Original"]);
    expect(
      alignAutoTags(
        ["Ice", "Twitch", "Level 0", "Frozen", "Original", "SIXLEGCOW", "B"],
        ["B Class", "Ice", "SIXLEGCOW", "Level 0", "Frozen Biome"],
      ),
    ).toEqual([
      "B Class",
      "Ice",
      "SIXLEGCOW",
      "Level 0",
      "Frozen Biome",
      "Twitch",
      "Original",
    ]);
    expect(
      alignAutoTags(
        ["Experimental", "A", "Twitch", "Original"],
        ["A Class", "Experimental", "Multi-tool"],
      ),
    ).toEqual([
      "A Class",
      "Experimental",
      "Multi-tool",
      "Twitch",
      "Original",
    ]);
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
