import { describe, expect, it } from "vitest";
import { remapSlotIndex, reorderSlots } from "@/lib/nms/reorder";
import {
  UNITS_MAX,
  reorderShipOwnership,
  setPlayerCurrencies,
  unitsOutsideRange,
} from "@/lib/nms/write";
import { listShips } from "@/lib/nms/extract/ships";
import { summarizePlayer } from "@/lib/nms/player";

const emptySlot = {
  Name: "",
  Resource: { Filename: "", Seed: [false, "0x0"] },
};

const named = (name: string, filename: string) => ({
  Name: name,
  Resource: {
    Filename: `MODELS/COMMON/SPACECRAFT/${filename}`,
    Seed: [true, "0x1"],
  },
  Inventory: { Class: { InventoryClass: "S" } },
});

function saveWithShips(extra: Record<string, unknown> = {}) {
  return {
    Version: 6783,
    BaseContext: {
      GameMode: 5,
      PlayerStateData: {
        ShipOwnership: [
          named("Alpha", "FIGHTERS/FIGHTER_PROC.SCENE.MBIN"),
          emptySlot,
          named("Beta", "DROPSHIPS/DROPSHIP_PROC.SCENE.MBIN"),
        ],
        ShipUsesLegacyColours: [true, false, false],
        PrimaryShip: 0,
        CorvetteEditAssociatedShipIndex: 2,
        Units: 10,
        Nanites: 20,
        Specials: 30,
        ...extra,
      },
    },
  };
}

describe("reorderSlots", () => {
  it("troca índices e mantém o length; vazios participam", () => {
    const slots = ["A", "", "C"];
    const swapped = reorderSlots(slots, 0, 1);
    expect(swapped).toEqual(["", "A", "C"]);
    expect(swapped).toHaveLength(3);
    expect(slots).toEqual(["A", "", "C"]);
  });

  it("recusa compactar/expandir via índices inválidos", () => {
    expect(() => reorderSlots(["a"], 0, 1)).toThrow(/fora/);
  });

  it("remapilha ponteiros no swap", () => {
    expect(remapSlotIndex(0, 0, 2)).toBe(2);
    expect(remapSlotIndex(2, 0, 2)).toBe(0);
    expect(remapSlotIndex(1, 0, 2)).toBe(1);
  });
});

describe("reorderShipOwnership", () => {
  it("reordena naves, cores paralelas e ponteiros sem mudar o length", () => {
    const json = saveWithShips();
    const result = reorderShipOwnership(json, 0, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ships = listShips(result.json);
    expect(ships).toHaveLength(3);
    expect(ships[0]?.empty).toBe(true);
    expect(ships[1]?.name).toBe("Alpha");
    expect(ships[2]?.name).toBe("Beta");
    const player = (
      result.json as {
        BaseContext: { PlayerStateData: Record<string, unknown> };
      }
    ).BaseContext.PlayerStateData;
    expect(player.ShipUsesLegacyColours).toEqual([false, true, false]);
    expect(player.PrimaryShip).toBe(1);
    expect(player.CorvetteEditAssociatedShipIndex).toBe(2);
    expect(player.ShipOwnership).toHaveLength(3);
  });
});

describe("setPlayerCurrencies", () => {
  it("grava Units, Nanites e Specials no PlayerStateData", () => {
    const result = setPlayerCurrencies(saveWithShips(), {
      units: 99,
      nanites: 88,
      specials: 77,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const summary = summarizePlayer(result.json);
    expect(summary.units).toBe(99);
    expect(summary.nanites).toBe(88);
    expect(summary.specials).toBe(77);
  });

  it("grava só o campo enviado", () => {
    const result = setPlayerCurrencies(saveWithShips(), { units: 3_000_000_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const summary = summarizePlayer(result.json);
    expect(summary.units).toBe(3_000_000_000);
    expect(summary.nanites).toBe(20);
    expect(summary.specials).toBe(30);
  });

  it("sinaliza Units fora de 0–4.294.967.295", () => {
    expect(unitsOutsideRange(UNITS_MAX)).toBe(false);
    expect(unitsOutsideRange(UNITS_MAX + 1)).toBe(true);
    expect(unitsOutsideRange(-1)).toBe(true);
  });
});
