import { describe, expect, it } from "vitest";
import {
  companionBattleFromArchived,
  companionBattleStats,
  companionClassFromRank,
  companionElement,
  companionLevel,
  companionRankFromMetadata,
  formatCompanionRank,
  normalizeItemClass,
  parseCompanionRank,
} from "@/lib/nms/extract/companion-battle";

describe("companionElement", () => {
  it("mapeia bioma para afinidade da arena em inglês", () => {
    expect(companionElement("Frozen", "Passive")).toBe("Ice");
    expect(companionElement("Lush", "Passive")).toBe("Tropical");
    expect(companionElement("Toxic", "Passive")).toBe("Toxic");
    expect(companionElement("Scorched", "Prey")).toBe("Fire");
    expect(companionElement("Barren", "Cat")).toBe("Desert");
    expect(companionElement("Weird", "Passive")).toBe("Anomalous");
  });

  it("trata MiniRobo e sentinelas como Mechanical", () => {
    expect(companionElement("Lush", "MiniRobo")).toBe("Mechanical");
    expect(companionElement("Frozen", "Walker")).toBe("Mechanical");
  });
});

describe("companionLevel", () => {
  it("soma os gene-edits das três stats (30 no máximo)", () => {
    expect(companionLevel([2, 10, 0])).toBe("12");
    expect(companionLevel([10, 10, 10])).toBe("30");
    expect(companionLevel([0, 0, 0])).toBe("0");
    expect(companionLevel([])).toBe("");
  });
});

describe("companionBattleStats", () => {
  it("não usa o override C/C/C como rank", () => {
    const stats = companionBattleStats({
      Biome: { Biome: "Frozen" },
      CreatureType: { CreatureType: "Passive" },
      PetBattlerTreatsEaten: [1, 4, 7],
      PetBattlerCoreStatClassOverrides: [
        { InventoryClass: "C" },
        { InventoryClass: "C" },
        { InventoryClass: "C" },
      ],
    });
    expect(stats).toEqual({
      biome: "Frozen",
      element: "Ice",
      level: "12",
    });
  });

  it("lê bioma/elemento do extra arquivado ou do payload", () => {
    expect(companionBattleFromArchived({ extra: { biome: "Lush" } })).toEqual({
      biome: "Lush",
      element: "",
      level: "",
    });
    expect(
      companionBattleFromArchived({
        extra: {},
        payload: {
          Biome: { Biome: "Frozen" },
          CreatureType: { CreatureType: "Passive" },
          PetBattlerTreatsEaten: [1],
        },
      }),
    ).toEqual({ biome: "Frozen", element: "Ice", level: "1" });
  });

  it("prefere o payload quando o extra antigo tem level/elemento errados", () => {
    expect(
      companionBattleFromArchived({
        extra: { biome: "Lush", element: "Tóxico", level: "10" },
        payload: {
          Biome: { Biome: "Lush" },
          CreatureType: { CreatureType: "Passive" },
          PetBattlerTreatsEaten: [10, 10, 10],
        },
      }),
    ).toEqual({ biome: "Lush", element: "Tropical", level: "30" });
  });
});

describe("companion rank metadata", () => {
  it("formata e lê Atk/Agi/HP", () => {
    expect(formatCompanionRank({ atk: "S", agi: "A", hp: "S" })).toBe("S/A/S");
    expect(parseCompanionRank("s / a / s")).toEqual({
      atk: "S",
      agi: "A",
      hp: "S",
    });
    expect(formatCompanionRank({ atk: "S", agi: "", hp: "S" })).toBe("");
  });

  it("ignora o C/C/C extraído do override", () => {
    expect(
      companionRankFromMetadata({
        className: "C",
        extra: { classes: "C / C / C", atk: "C" },
      }),
    ).toEqual({ atk: "", agi: "", hp: "" });
    expect(
      companionRankFromMetadata({ extra: { rank: "S/S/S" } }),
    ).toEqual({ atk: "S", agi: "S", hp: "S" });
  });

  it("deriva SSS/SS/S ou a pior letra", () => {
    expect(companionClassFromRank({ atk: "S", agi: "S", hp: "S" })).toBe("SSS");
    expect(companionClassFromRank({ atk: "S", agi: "S", hp: "A" })).toBe("SS");
    expect(companionClassFromRank({ atk: "S", agi: "A", hp: "B" })).toBe("S");
    expect(companionClassFromRank({ atk: "A", agi: "B", hp: "C" })).toBe("C");
    expect(companionClassFromRank({ atk: "A", agi: "B", hp: "A" })).toBe("B");
    expect(companionClassFromRank({ atk: "A", agi: "A", hp: "A" })).toBe("A");
    expect(companionClassFromRank({ atk: "S", agi: "", hp: "S" })).toBe("");
  });

  it("normaliza S/S/S antigo para SSS", () => {
    expect(normalizeItemClass("S/S/S")).toBe("SSS");
    expect(normalizeItemClass("S/A/S")).toBe("SS");
    expect(normalizeItemClass("SSS")).toBe("SSS");
    expect(normalizeItemClass("s")).toBe("S");
  });
});
