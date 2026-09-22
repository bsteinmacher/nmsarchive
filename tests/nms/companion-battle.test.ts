import { describe, expect, it } from "vitest";
import {
  companionBattleFromArchived,
  companionBattleStats,
  companionElement,
  companionLevel,
  companionRankFromMetadata,
  formatCompanionRank,
  parseCompanionRank,
} from "@/lib/nms/extract/companion-battle";

describe("companionElement", () => {
  it("mapeia bioma para afinidade da arena", () => {
    expect(companionElement("Frozen", "Passive")).toBe("Gelo");
    expect(companionElement("Lush", "Passive")).toBe("Tropical");
    expect(companionElement("Scorched", "Prey")).toBe("Fogo");
    expect(companionElement("Barren", "Cat")).toBe("Deserto");
    expect(companionElement("Weird", "Passive")).toBe("Anômalo");
  });

  it("trata MiniRobo e sentinelas como Mecânico", () => {
    expect(companionElement("Lush", "MiniRobo")).toBe("Mecânico");
    expect(companionElement("Frozen", "Walker")).toBe("Mecânico");
  });
});

describe("companionLevel", () => {
  it("usa o maior gene-edit das três stats", () => {
    expect(companionLevel([2, 10, 0])).toBe("10");
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
      element: "Gelo",
      level: "7",
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
    ).toEqual({ biome: "Frozen", element: "Gelo", level: "1" });
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
});
