import { describe, expect, it } from "vitest";
import { listFilledShips, listShips } from "@/lib/nms/extract/ships";
import { insertShip } from "@/lib/nms/write";

const emptySlot = {
  Name: "",
  Resource: { Filename: "", Seed: [false, "0x0"] },
};

const filled = {
  Name: "Golden Vector",
  Resource: {
    Filename: "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTER_PROC.SCENE.MBIN",
    Seed: [true, "0xABCDEF"],
  },
  Inventory: { Class: { InventoryClass: "S" } },
};

function saveWithSlots(slots: unknown[]) {
  return {
    Version: 6783,
    BaseContext: {
      GameMode: 5,
      PlayerStateData: { ShipOwnership: slots },
    },
  };
}

describe("extract/insert ships", () => {
  it("lista todos os slots, inclusive vazios, com Ship Type", () => {
    const ships = listShips(saveWithSlots([filled, emptySlot]));
    expect(ships).toHaveLength(2);
    expect(ships[0]).toMatchObject({
      index: 0,
      name: "Golden Vector",
      seed: "0xabcdef",
      className: "S",
      shipType: "Fighter",
      empty: false,
    });
    expect(ships[1]).toMatchObject({
      index: 1,
      name: "Slot 2 vazio",
      empty: true,
    });
    expect(listFilledShips(saveWithSlots([filled, emptySlot]))).toHaveLength(1);
  });

  it("importa no primeiro slot vazio e recusa se estiver cheio", () => {
    const ok = insertShip(saveWithSlots([filled, emptySlot]), {
      Name: "Imported",
      Resource: { Filename: "MODELS/X.SCENE.MBIN", Seed: [true, "0x1"] },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.index).toBe(1);
      expect(listFilledShips(ok.json)).toHaveLength(2);
      expect(listShips(ok.json)).toHaveLength(2);
    }

    const full = insertShip(saveWithSlots([filled, filled]), filled);
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.error).toMatch(/slot vazio/i);
  });
});
