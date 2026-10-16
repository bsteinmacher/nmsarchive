import { describe, expect, it } from "vitest";
import {
  groupArchiveTypes,
  mergeArchiveFilterOptions,
} from "@/lib/type-groups";

describe("groupArchiveTypes", () => {
  it("agrupa por família numa ordem estável", () => {
    const groups = groupArchiveTypes([
      { category: "ship", shipType: "Fighter" },
      { category: "companion", shipType: "TREX" },
      { category: "multitool", shipType: "Staff" },
      { category: "deepspace", shipType: "Deep Space" },
      { category: "base", shipType: "Planet" },
      { category: "ship", shipType: "Hauler" },
    ]);
    expect(groups.map((group) => group.id)).toEqual([
      "multitool",
      "companion",
      "ship",
      "base",
    ]);
    expect(groups.find((group) => group.id === "ship")?.types).toEqual([
      "Fighter",
      "Hauler",
    ]);
    expect(groups.find((group) => group.id === "base")?.types).toEqual([
      "Deep Space",
      "Planet",
    ]);
  });
});

describe("mergeArchiveFilterOptions", () => {
  it("une type groups de Freighter e Frigate", () => {
    const merged = mergeArchiveFilterOptions([
      {
        classes: ["S"],
        types: ["Pirate"],
        typeGroups: [
          { id: "freighter", label: "Freighters", types: ["Pirate"] },
        ],
        galaxies: [],
        tags: [{ slug: "s", label: "S" }],
      },
      {
        classes: ["A"],
        types: ["Ghost"],
        typeGroups: [{ id: "frigate", label: "Frigates", types: ["Ghost"] }],
        galaxies: [],
        tags: [{ slug: "s", label: "S" }],
      },
    ]);
    expect(merged.typeGroups.map((group) => group.id)).toEqual([
      "freighter",
      "frigate",
    ]);
    expect(merged.classes).toEqual(["A", "S"]);
    expect(merged.tags).toEqual([{ slug: "s", label: "S" }]);
  });
});
