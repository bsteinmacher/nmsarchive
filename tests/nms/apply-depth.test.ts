import { describe, expect, it } from "vitest";
import { applyItem, reorderCategory } from "@/lib/nms/extract";
import { applyShip } from "@/lib/nms/extract/ships";
import { getPlayerState } from "@/lib/nms/player";
import { asArray, asRecord, asString } from "@/lib/nms/value";

const HAULER =
  "MODELS/COMMON/SPACECRAFT/DROPSHIPS/DROPSHIP_PROC.SCENE.MBIN";
const FIGHTER =
  "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTER_PROC.SCENE.MBIN";

function tech(id: string, x: number, y: number) {
  return {
    Type: { InventoryType: "Technology" },
    Id: id,
    Index: { X: x, Y: y },
  };
}

function product(id: string, x: number, y: number) {
  return {
    Type: { InventoryType: "Product" },
    Id: id,
    Index: { X: x, Y: y },
    Amount: 4,
  };
}

function special(x: number, y: number) {
  return {
    Type: { InventorySpecialSlotType: "TechBonus" },
    Index: { X: x, Y: y },
  };
}

const destShip = {
  Name: "Minha nave",
  Location: 2,
  Position: [1, 2, 3, 4],
  Direction: [0, 1, 0, 0],
  Resource: {
    Filename: HAULER,
    Seed: [true, "0x111"],
  },
  Inventory: {
    Class: { InventoryClass: "C" },
    Width: 5,
    Height: 3,
    ValidSlotIndices: [0, 1],
    SpecialSlots: [special(0, 0)],
    Slots: [tech("DEST_TECH", 0, 0), product("DEST_CARGO", 1, 0)],
    Name: "grid-dest",
  },
  InventoryLayout: { Slots: 8, Seed: [true, "0xAAA"], Level: 1 },
};

const sourceShip = {
  Name: "Fighter arquivada",
  Location: 9,
  Resource: {
    Filename: FIGHTER,
    Seed: [true, "0x222"],
  },
  Inventory: {
    Class: { InventoryClass: "S" },
    Width: 8,
    Height: 6,
    ValidSlotIndices: [0, 1, 2, 3],
    SpecialSlots: [special(3, 2)],
    Slots: [tech("SRC_TECH", 2, 1), product("SRC_CARGO", 4, 1)],
    BaseStatValues: [{ BaseStatID: "Ship_Damage", Value: 1 }],
    Name: "grid-src",
  },
  InventoryLayout: { Slots: 30, Seed: [true, "0xBBB"], Level: 3 },
};

function saveWith(ship: unknown, empty = true) {
  const slots = empty
    ? [ship, { Name: "", Resource: { Filename: "", Seed: [false, "0x0"] } }]
    : [ship];
  return {
    BaseContext: {
      PlayerStateData: {
        ShipOwnership: slots,
        ShipUsesLegacyColours: [true, true],
        CharacterCustomisationData: [{}, {}, {}, { CustomData: { Colours: ["old"] } }],
      },
    },
  };
}

function ownershipAt(json: unknown, index = 0) {
  return asRecord(asArray(getPlayerState(json)?.ShipOwnership)?.[index]);
}

describe("apply ship depths", () => {
  it("modelo troca tipo e classe e mantém carga, tech e supercharged", () => {
    const result = applyShip(
      saveWith(destShip, false),
      0,
      { kind: "ship", ownership: sourceShip, customisation: { CustomData: { Colours: ["red"] } } },
      "model",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ship = ownershipAt(result.json);
    const inventory = asRecord(ship?.Inventory);
    expect(asString(asRecord(ship?.Resource)?.Filename)).toBe(FIGHTER);
    expect(asString(asRecord(inventory?.Class)?.InventoryClass)).toBe("S");
    expect(ship?.Name).toBe("Minha nave");
    expect(ship?.Location).toBe(2);
    expect(inventory?.SpecialSlots).toEqual([special(0, 0)]);
    expect(inventory?.Slots).toEqual([
      tech("DEST_TECH", 0, 0),
      product("DEST_CARGO", 1, 0),
    ]);
    expect(inventory?.Width).toBe(5);
    expect(ship?.InventoryLayout).toEqual(destShip.InventoryLayout);
    const ccd = asArray(getPlayerState(result.json)?.CharacterCustomisationData);
    expect(asRecord(asRecord(ccd?.[3])?.CustomData)?.Colours).toEqual(["red"]);
    expect(asArray(getPlayerState(result.json)?.ShipUsesLegacyColours)?.[0]).toBe(
      false,
    );
  });

  it("trocar leva slots e tech da origem e esvazia a carga", () => {
    const result = applyShip(saveWith(destShip, false), 0, sourceShip, "tech");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ship = ownershipAt(result.json);
    const inventory = asRecord(ship?.Inventory);
    expect(inventory?.ValidSlotIndices).toEqual([0, 1, 2, 3]);
    expect(inventory?.Width).toBe(8);
    expect(inventory?.SpecialSlots).toEqual([special(3, 2)]);
    expect(inventory?.BaseStatValues).toEqual(sourceShip.Inventory.BaseStatValues);
    expect(inventory?.Slots).toEqual([tech("SRC_TECH", 2, 1)]);
    expect(inventory?.Name).toBe("grid-dest");
    expect(ship?.Name).toBe("Minha nave");
    expect(ship?.Position).toEqual([1, 2, 3, 4]);
    expect(ship?.InventoryLayout).toEqual(sourceShip.InventoryLayout);
  });

  it("criar no slot vazio copia o item e deixa o inventário só com tech", () => {
    const result = applyItem(saveWith(destShip), "ship", sourceShip);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.index).toBe(1);
    const ship = ownershipAt(result.json, 1);
    expect(ship?.Name).toBe("Fighter arquivada");
    expect(asRecord(ship?.Inventory)?.Slots).toEqual([tech("SRC_TECH", 2, 1)]);
  });
});

describe("apply companion level", () => {
  it("nível 0 zera PetBattlerTreatsEaten", () => {
    const save = {
      BaseContext: {
        PlayerStateData: {
          Pets: [
            {
              CreatureID: "kept",
              CustomName: "A",
              PetBattlerTreatsEaten: [1, 4, 7],
            },
            { CreatureID: "", CustomName: "" },
          ],
        },
      },
    };
    const result = applyItem(
      save,
      "companion",
      {
        CreatureID: "bird",
        CustomName: "Arquivado",
        PetBattlerTreatsEaten: [1, 4, 7],
      },
      "0x1",
      "main",
      { index: 0, companionLevel: "zero" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pet = asRecord(asArray(getPlayerState(result.json)?.Pets)?.[0]);
    expect(pet?.PetBattlerTreatsEaten).toEqual([0, 0, 0]);
    expect(pet?.CustomName).toBe("Arquivado");
  });
});

describe("apply multitool and freighter", () => {
  it("modelo da multi-tool troca classe e resource e mantém o store", () => {
    const save = {
      BaseContext: {
        PlayerStateData: {
          Multitools: [
            {
              Name: "Minha MT",
              Seed: [true, "0x1"],
              Resource: {
                Filename: "MODELS/ROYALMULTITOOL.SCENE.MBIN",
                Seed: [true, "0x1"],
              },
              Store: {
                Class: { InventoryClass: "C" },
                Slots: [product("KEEP", 0, 0)],
                SpecialSlots: [special(0, 0)],
              },
            },
          ],
        },
      },
    };
    const result = applyItem(
      save,
      "multitool",
      {
        Name: "Arquivada",
        Seed: [true, "0x9"],
        Resource: {
          Filename: "MODELS/STAFFMULTITOOL.SCENE.MBIN",
          Seed: [true, "0x9"],
        },
        Store: {
          Class: { InventoryClass: "S" },
          Slots: [product("NEW", 1, 1)],
          SpecialSlots: [special(2, 2)],
        },
      },
      "0x9",
      "main",
      { index: 0, depth: "model" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tool = asRecord(asArray(getPlayerState(result.json)?.Multitools)?.[0]);
    const store = asRecord(tool?.Store);
    expect(tool?.Name).toBe("Minha MT");
    expect(asString(asRecord(tool?.Resource)?.Filename)).toContain("STAFF");
    expect(asString(asRecord(store?.Class)?.InventoryClass)).toBe("S");
    expect(store?.Slots).toEqual([product("KEEP", 0, 0)]);
    expect(store?.SpecialSlots).toEqual([special(0, 0)]);
  });

  it("importar modelo copia as peças da staff e a arma na mão, e mantém nome e tech", () => {
    const parts = {
      DescriptorGroups: ["^STAFF_HEAD_1", "^STAFF_CORE_1", "^STAFF_POLE_1"],
      Colours: [{ Colour: [0.41, 0.12, 0.05, 1] }],
    };
    const screen = {
      ScreenScale: 0.03,
      ScreenOffset: [0.02, 0.12, -0.1],
      ScreenRotation: [0, 1, 0, 1.92],
    };
    const held = {
      Filename: "MODELS/COMMON/WEAPONS/MULTITOOL/MULTITOOL.SCENE.MBIN",
      GenerationSeed: [true, "0x55907B79D95B675B"],
    };
    const save = {
      BaseContext: {
        PlayerStateData: {
          ActiveMultioolIndex: 0,
          CurrentWeapon: structuredClone(held),
          Multitools: [
            {
              Name: "Minha MT",
              Seed: [true, "0x1"],
              IsLarge: false,
              PrimaryMode: 5,
              SecondaryMode: 17,
              ScreenData: { ScreenScale: 1 },
              CustomisationData: { DescriptorGroups: [] },
              Resource: {
                Filename: "MODELS/ROYALMULTITOOL.SCENE.MBIN",
                Seed: [true, "0x1"],
              },
              Store: {
                Class: { InventoryClass: "C" },
                Slots: [product("KEEP", 0, 0)],
                SpecialSlots: [special(0, 0)],
              },
            },
            {
              Name: "Outra",
              Seed: [true, "0x2"],
              Resource: {
                Filename: "MODELS/MULTITOOL.SCENE.MBIN",
                Seed: [true, "0x2"],
              },
              Store: { Class: { InventoryClass: "A" }, Slots: [] },
            },
          ],
        },
      },
    };
    const staff = {
      Name: "Arquivada",
      Seed: [true, "0xD9CD93CC260E592E"],
      IsLarge: true,
      PrimaryMode: 2,
      SecondaryMode: 8,
      ScreenData: screen,
      CustomisationData: parts,
      Resource: {
        Filename: "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOL.SCENE.MBIN",
        Seed: [false, "0x0"],
      },
      Store: {
        Class: { InventoryClass: "S" },
        Slots: [product("NEW", 1, 1)],
        SpecialSlots: [special(4, 0)],
      },
    };
    const result = applyItem(save, "multitool", staff, "0xd9cd93cc260e592e", "main", {
      index: 0,
      depth: "model",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = getPlayerState(result.json);
    const tool = asRecord(asArray(player?.Multitools)?.[0]);
    const store = asRecord(tool?.Store);
    expect(tool?.Name).toBe("Minha MT");
    expect(tool?.PrimaryMode).toBe(5);
    expect(tool?.SecondaryMode).toBe(17);
    expect(tool?.IsLarge).toBe(true);
    expect(tool?.CustomisationData).toEqual(parts);
    expect(tool?.ScreenData).toEqual(screen);
    expect(store?.Slots).toEqual([product("KEEP", 0, 0)]);
    expect(store?.SpecialSlots).toEqual([special(0, 0)]);
    expect(player?.CurrentWeapon).toEqual({
      Filename: "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOL.SCENE.MBIN",
      GenerationSeed: [true, "0xD9CD93CC260E592E"],
    });

    const inactive = applyItem(save, "multitool", staff, "0xd9cd93cc260e592e", "main", {
      index: 1,
      depth: "model",
    });
    expect(inactive.ok).toBe(true);
    if (!inactive.ok) return;
    expect(getPlayerState(inactive.json)?.CurrentWeapon).toEqual(held);
  });

  it("reordenar o slot ativo leva a arma na mão junto", () => {
    const staffSeed = [true, "0xD9CD93CC260E592E"];
    const rifleSeed = [true, "0x55907B79D95B675B"];
    const save = {
      BaseContext: {
        PlayerStateData: {
          ActiveMultioolIndex: 0,
          CurrentWeapon: {
            Filename: "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOL.SCENE.MBIN",
            GenerationSeed: staffSeed,
          },
          Multitools: [
            {
              Name: "Staff",
              Seed: staffSeed,
              Resource: {
                Filename: "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOL.SCENE.MBIN",
                Seed: [false, "0x0"],
              },
            },
            {
              Name: "Rifle",
              Seed: rifleSeed,
              Resource: {
                Filename: "MODELS/COMMON/WEAPONS/MULTITOOL/MULTITOOL.SCENE.MBIN",
                Seed: rifleSeed,
              },
            },
          ],
        },
      },
    };
    const result = reorderCategory(save, "multitool", 0, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = getPlayerState(result.json);
    expect(player?.ActiveMultioolIndex).toBe(1);
    expect(player?.CurrentWeapon).toEqual({
      Filename: "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOL.SCENE.MBIN",
      GenerationSeed: staffSeed,
    });
  });

  it("modelo da cargueira atual troca o resource e mantém nome, sistema e carga", () => {
    const save = {
      BaseContext: {
        PlayerStateData: {
          PlayerFreighterName: "Meu freighter",
          CurrentFreighterHomeSystemSeed: [true, "0xHOME"],
          CurrentFreighter: {
            Filename: "MODELS/PIRATEFREIGHTER.SCENE.MBIN",
            Seed: [true, "0x1"],
          },
          FreighterInventory: {
            Class: { InventoryClass: "C" },
            Slots: [product("KEEP", 0, 0)],
            Name: "inv",
          },
          FreighterInventory_TechOnly: { Class: { InventoryClass: "C" } },
          FreighterInventory_Cargo: { Class: { InventoryClass: "C" } },
        },
      },
    };
    const result = applyItem(
      save,
      "freighter",
      {
        kind: "current",
        Resource: {
          Filename: "MODELS/CAPITALFREIGHTER.SCENE.MBIN",
          Seed: [true, "0x2"],
        },
        Inventory: {
          Class: { InventoryClass: "S" },
          Slots: [product("NEW", 1, 1)],
          Name: "other",
        },
        Inventory_TechOnly: { Class: { InventoryClass: "S" } },
        Inventory_Cargo: { Class: { InventoryClass: "S" } },
        PlayerFreighterName: "Arquivado",
        CurrentFreighterHomeSystemSeed: [true, "0xOTHER"],
      },
      "0x2",
      "main",
      { index: 0, depth: "model" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = getPlayerState(result.json);
    expect(player?.PlayerFreighterName).toBe("Meu freighter");
    expect(player?.CurrentFreighterHomeSystemSeed).toEqual([true, "0xHOME"]);
    expect(asString(asRecord(player?.CurrentFreighter)?.Filename)).toContain(
      "CAPITAL",
    );
    const inventory = asRecord(player?.FreighterInventory);
    expect(asString(asRecord(inventory?.Class)?.InventoryClass)).toBe("S");
    expect(inventory?.Slots).toEqual([product("KEEP", 0, 0)]);
  });

  it("trocar a multi-tool leva tech da origem e esvazia o store", () => {
    const save = {
      BaseContext: {
        PlayerStateData: {
          Multitools: [
            {
              Name: "Minha MT",
              Seed: [true, "0x1"],
              Resource: {
                Filename: "MODELS/ROYALMULTITOOL.SCENE.MBIN",
                Seed: [true, "0x1"],
              },
              Store: {
                Class: { InventoryClass: "C" },
                Width: 4,
                Slots: [product("KEEP", 0, 0), tech("DEST_TECH", 1, 0)],
              },
            },
          ],
        },
      },
    };
    const result = applyItem(
      save,
      "multitool",
      {
        Name: "Arquivada",
        Seed: [true, "0x9"],
        Resource: {
          Filename: "MODELS/STAFFMULTITOOL.SCENE.MBIN",
          Seed: [true, "0x9"],
        },
        Store: {
          Class: { InventoryClass: "S" },
          Width: 8,
          Slots: [product("NEW", 1, 1), tech("SRC_TECH", 2, 1)],
        },
      },
      "0x9",
      "main",
      { index: 0, depth: "tech" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tool = asRecord(asArray(getPlayerState(result.json)?.Multitools)?.[0]);
    const store = asRecord(tool?.Store);
    expect(tool?.Name).toBe("Minha MT");
    expect(store?.Width).toBe(8);
    expect(store?.Slots).toEqual([tech("SRC_TECH", 2, 1)]);
  });

  it("trocar a cargueira atual leva tech e esvazia a carga", () => {
    const save = {
      BaseContext: {
        PlayerStateData: {
          PlayerFreighterName: "Meu freighter",
          CurrentFreighterHomeSystemSeed: [true, "0xHOME"],
          CurrentFreighter: {
            Filename: "MODELS/PIRATEFREIGHTER.SCENE.MBIN",
            Seed: [true, "0x1"],
          },
          FreighterInventory: {
            Class: { InventoryClass: "C" },
            Slots: [product("KEEP", 0, 0), tech("DEST_TECH", 0, 1)],
            Name: "inv",
          },
          FreighterInventory_TechOnly: {
            Class: { InventoryClass: "C" },
            Slots: [tech("DEST_ONLY", 0, 0)],
          },
          FreighterInventory_Cargo: {
            Class: { InventoryClass: "C" },
            Slots: [product("DEST_CARGO", 0, 0)],
          },
          FreighterLayout: { Slots: 10 },
        },
      },
    };
    const result = applyItem(
      save,
      "freighter",
      {
        kind: "current",
        Resource: {
          Filename: "MODELS/CAPITALFREIGHTER.SCENE.MBIN",
          Seed: [true, "0x2"],
        },
        Inventory: {
          Class: { InventoryClass: "S" },
          Slots: [product("NEW", 1, 1), tech("SRC_TECH", 2, 1)],
          Name: "other",
        },
        Inventory_TechOnly: {
          Class: { InventoryClass: "S" },
          Slots: [tech("SRC_ONLY", 0, 0)],
        },
        Inventory_Cargo: {
          Class: { InventoryClass: "S" },
          Slots: [product("SRC_CARGO", 0, 0)],
        },
        PlayerFreighterName: "Arquivado",
        FreighterLayout: { Slots: 40 },
        CurrentFreighterHomeSystemSeed: [true, "0xOTHER"],
      },
      "0x2",
      "main",
      { index: 0, depth: "tech" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = getPlayerState(result.json);
    expect(player?.PlayerFreighterName).toBe("Meu freighter");
    expect(player?.CurrentFreighterHomeSystemSeed).toEqual([true, "0xHOME"]);
    expect(player?.FreighterLayout).toEqual({ Slots: 40 });
    expect(asRecord(player?.FreighterInventory)?.Slots).toEqual([
      tech("SRC_TECH", 2, 1),
    ]);
    expect(asRecord(player?.FreighterInventory_TechOnly)?.Slots).toEqual([
      tech("SRC_ONLY", 0, 0),
    ]);
    expect(asRecord(player?.FreighterInventory_Cargo)?.Slots).toEqual([]);
    expect(asRecord(player?.FreighterInventory)?.Name).toBe("inv");
  });
});
