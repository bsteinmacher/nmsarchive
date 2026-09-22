import { describe, expect, it } from "vitest";
import { remapSlotIndex, reorderSlots, shipCustomisationIndex } from "@/lib/nms/reorder";
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

describe("shipCustomisationIndex", () => {
  it("mapeia os 12 slots para as faixas 3–8 e 17–22", () => {
    expect(shipCustomisationIndex(0)).toBe(3);
    expect(shipCustomisationIndex(2)).toBe(5);
    expect(shipCustomisationIndex(5)).toBe(8);
    expect(shipCustomisationIndex(6)).toBe(17);
    expect(shipCustomisationIndex(11)).toBe(22);
    expect(shipCustomisationIndex(-1)).toBeNull();
    expect(shipCustomisationIndex(12)).toBeNull();
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

  it("leva o casco PlayerShipBase (UserData) junto da Corvette e não mexe na Freighter", () => {
    const json = saveWithShips({
      PersistentPlayerBases: [
        {
          Name: "Corvette A",
          BaseType: { PersistentBaseTypes: "PlayerShipBase" },
          UserData: 0,
          Objects: [{ ObjectID: "^A" }],
        },
        {
          Name: "Corvette B",
          BaseType: { PersistentBaseTypes: "PlayerShipBase" },
          UserData: 2,
          Objects: [{ ObjectID: "^B" }],
        },
        {
          Name: "Freighter",
          BaseType: { PersistentBaseTypes: "FreighterBase" },
          UserData: 0,
          Objects: [{ ObjectID: "^F" }],
        },
      ],
    });
    const result = reorderShipOwnership(json, 0, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = (
      result.json as {
        BaseContext: { PlayerStateData: Record<string, unknown> };
      }
    ).BaseContext.PlayerStateData;
    const bases = player.PersistentPlayerBases as Array<Record<string, unknown>>;
    expect(bases[0]?.UserData).toBe(2);
    expect(bases[1]?.UserData).toBe(0);
    expect(bases[2]?.UserData).toBe(0);
    expect((bases[0]?.Objects as unknown[]).length).toBe(1);
    expect(
      (bases[0]?.BaseType as { PersistentBaseTypes: string }).PersistentBaseTypes,
    ).toBe("PlayerShipBase");
  });

  it("leva CharacterCustomisationData da nave (peças/cores) e não mexe em player/veículo", () => {
    const ccd: Array<{ id: number; parts?: string }> = Array.from(
      { length: 26 },
      (_, i) => ({ id: i }),
    );
    ccd[5] = { id: 5, parts: "vulture" };
    ccd[8] = { id: 8, parts: "empty" };
    const json = saveWithShips({
      ShipOwnership: [
        named("Alpha", "FIGHTERS/FIGHTER_PROC.SCENE.MBIN"),
        emptySlot,
        named("Vulture", "DROPSHIPS/DROPSHIP_PROC.SCENE.MBIN"),
        emptySlot,
        emptySlot,
        emptySlot,
        emptySlot,
        emptySlot,
        emptySlot,
        emptySlot,
        emptySlot,
        emptySlot,
      ],
      ShipUsesLegacyColours: Array.from({ length: 12 }, () => false),
      CharacterCustomisationData: ccd,
    });
    const result = reorderShipOwnership(json, 2, 5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = (
      result.json as {
        BaseContext: { PlayerStateData: Record<string, unknown> };
      }
    ).BaseContext.PlayerStateData;
    const after = player.CharacterCustomisationData as Array<{
      id: number;
      parts?: string;
    }>;
    expect(after).toHaveLength(26);
    expect(after[5]).toEqual({ id: 8, parts: "empty" });
    expect(after[8]).toEqual({ id: 5, parts: "vulture" });
    expect(after[0]).toEqual({ id: 0 });
    expect(after[9]).toEqual({ id: 9 });
    expect(listShips(result.json)[5]?.name).toBe("Vulture");
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
