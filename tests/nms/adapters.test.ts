import { describe, expect, it } from "vitest";
import { listMultitools, multitoolsAdapter } from "@/lib/nms/extract/multitools";
import { listCompanions, companionsAdapter } from "@/lib/nms/extract/companions";
import {
  extractExosuitLayout,
  exosuitHasSubstanceSlots,
  insertExosuit,
  listExosuit,
} from "@/lib/nms/extract/exosuit";
import { listFreighters, insertFreighter } from "@/lib/nms/extract/freighters";
import { listFrigates } from "@/lib/nms/extract/frigates";
import { listBases, listFreighterBases } from "@/lib/nms/extract/bases";
import { insertWonder, listWonders } from "@/lib/nms/extract/wonders";
import { insertItem } from "@/lib/nms/extract";

const emptyMt = {
  Name: "",
  Resource: { Filename: "", Seed: [false, "0x0"] },
  Seed: [false, "0x0"],
  Store: { Class: { InventoryClass: "C" } },
};

const filledMt = {
  Name: "Atlas Sceptre",
  Resource: {
    Filename: "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOLATLAS.SCENE.MBIN",
    Seed: [true, "0x0"],
  },
  Seed: [true, "0xABCDEF"],
  Store: { Class: { InventoryClass: "S" } },
};

const emptyPet = {
  CreatureID: "",
  CustomName: "",
  CreatureSeed: [false, "0x0"],
  Biome: { Biome: "Lush" },
};

const filledPet = {
  CreatureID: "^HOVER_PET",
  CustomName: "Nimbus",
  CreatureSeed: [true, "0xDF"],
  CustomSpeciesName: "^UI_HOVERPET_SPECIES",
  Biome: { Biome: "Lush" },
  Descriptors: ["^366051701"],
};

function save(player: Record<string, unknown>) {
  return { Version: 1, BaseContext: { PlayerStateData: player } };
}

describe("multitools adapter", () => {
  it("lista vazios e tipo/classe, sem Filename na tabela", () => {
    const items = listMultitools(save({ Multitools: [filledMt, emptyMt] }));
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      name: "Atlas Sceptre",
      className: "S",
      itemType: "Atlas Staff",
      empty: false,
      seed: "0xabcdef",
    });
    expect(items[1]?.empty).toBe(true);
    expect(items[1]?.name).toBe("Slot 2 vazio");
  });

  it("importa no primeiro vazio e recusa array cheio", () => {
    const ok = multitoolsAdapter.insert(
      save({ Multitools: [filledMt, emptyMt] }),
      filledMt,
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.index).toBe(1);
    const full = multitoolsAdapter.insert(
      save({ Multitools: [filledMt, filledMt] }),
      filledMt,
    );
    expect(full.ok).toBe(false);
  });
});

describe("companions adapter", () => {
  it("lista CustomName, espécie, biome, elemento e vazios", () => {
    const items = listCompanions(save({ Pets: [filledPet, emptyPet] }));
    expect(items[0]).toMatchObject({
      name: "Nimbus",
      itemType: "HOVER_PET",
      extra: { biome: "Lush", element: "Tropical" },
      empty: false,
    });
    expect(items[1]?.empty).toBe(true);
  });

  it("reordena Pets e remapeia PetBattleTeam", () => {
    const json = save({
      Pets: [filledPet, emptyPet],
      UnlockedPetSlots: [true, true],
      PetAccessoryCustomisation: [{ Data: 0 }, { Data: 1 }],
      PetBattleTeam: { TeamMembers: [{ PetIndex: 0 }, { PetIndex: -1 }] },
    });
    const result = companionsAdapter.reorder?.(json, 0, 1);
    expect(result?.ok).toBe(true);
    if (!result?.ok) return;
    const listed = listCompanions(result.json);
    expect(listed[0]?.empty).toBe(true);
    expect(listed[1]?.name).toBe("Nimbus");
    const player = (
      result.json as {
        BaseContext: { PlayerStateData: Record<string, unknown> };
      }
    ).BaseContext.PlayerStateData;
    expect(player.UnlockedPetSlots).toEqual([true, true]);
    expect(player.PetAccessoryCustomisation).toEqual([
      { Data: 1 },
      { Data: 0 },
    ]);
    expect(player.PetBattleTeam).toEqual({
      TeamMembers: [{ PetIndex: 1 }, { PetIndex: -1 }],
    });
  });
});

describe("exosuit adapter", () => {
  const player = {
    Inventory: {
      Width: 10,
      Height: 12,
      ValidSlotIndices: [{ X: 0, Y: 0 }],
      SpecialSlots: [],
      Slots: [
        {
          Type: { InventoryType: "Substance" },
          Id: "^FUEL1",
          Index: { X: 0, Y: 0 },
        },
        {
          Type: { InventoryType: "Technology" },
          Id: "^JET1",
          Index: { X: 1, Y: 0 },
        },
      ],
    },
    Inventory_TechOnly: {
      Width: 10,
      Height: 6,
      ValidSlotIndices: [{ X: 0, Y: 0 }],
      SpecialSlots: [
        {
          Type: { InventorySpecialSlotType: "TechBonus" },
          Index: { X: 4, Y: 0 },
        },
      ],
      Slots: [
        {
          Type: { InventoryType: "Technology" },
          Id: "^HYPER",
          Index: { X: 0, Y: 0 },
        },
      ],
    },
    Inventory_Cargo: {
      Width: 7,
      Height: 5,
      ValidSlotIndices: [],
      SpecialSlots: [],
      Slots: [],
    },
  };

  it("arquiva só layout + tech, sem substâncias", () => {
    const listed = listExosuit(save(player));
    expect(listed).toHaveLength(1);
    expect(listed[0]?.extra.tech).toBe("2");
    expect(listed[0]?.extra.supercharged).toBe("1");
    expect(exosuitHasSubstanceSlots(listed[0]?.payload)).toBe(false);
    const layout = extractExosuitLayout(save(player))!;
    expect(
      (layout.Inventory.Slots as unknown[]).every(
        (s) =>
          (s as { Type: { InventoryType: string } }).Type.InventoryType ===
          "Technology",
      ),
    ).toBe(true);
  });

  it("aplica layout sem apagar substâncias do destino", () => {
    const payload = extractExosuitLayout(save(player))!;
    payload.Inventory.Width = 8;
    const dest = save({
      Inventory: {
        Width: 4,
        Height: 4,
        Slots: [
          {
            Type: { InventoryType: "Product" },
            Id: "^STORM_CRYSTAL",
            Index: { X: 0, Y: 0 },
          },
        ],
      },
      Inventory_TechOnly: { Width: 2, Height: 2, Slots: [] },
      Inventory_Cargo: { Width: 1, Height: 1, Slots: [] },
    });
    const result = insertExosuit(dest, payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inv = (
      result.json as {
        BaseContext: {
          PlayerStateData: { Inventory: { Width: number; Slots: unknown[] } };
        };
      }
    ).BaseContext.PlayerStateData.Inventory;
    expect(inv.Width).toBe(8);
    expect(inv.Slots.some((s) => (s as { Id: string }).Id === "^STORM_CRYSTAL")).toBe(
      true,
    );
  });
});

describe("freighter / frigate / base / wonder", () => {
  it("lista cargueira atual + frota vazia", () => {
    const items = listFreighters(
      save({
        CurrentFreighter: {
          Filename:
            "MODELS/COMMON/SPACECRAFT/INDUSTRIAL/PIRATEFREIGHTER.SCENE.MBIN",
          Seed: [true, "0xAB"],
        },
        FreighterInventory: { Class: { InventoryClass: "S" }, Name: "" },
        PlayerFreighterName: "Omen",
        FreighterFleet: [
          { Resource: { Filename: "", Seed: [false, "0x0"] } },
        ],
      }),
    );
    expect(items[0]).toMatchObject({
      name: "Omen",
      itemType: "Pirate",
      className: "S",
      slotLabel: "Atual",
      empty: false,
    });
    expect(items[1]?.empty).toBe(true);
  });

  it("substitui a cargueira atual no insert kind=current", () => {
    const json = save({
      CurrentFreighter: { Filename: "A", Seed: [true, "0x1"] },
      FreighterInventory: {},
      FreighterInventory_TechOnly: {},
      FreighterInventory_Cargo: {},
      FreighterFleet: [],
    });
    const result = insertFreighter(json, {
      kind: "current",
      Resource: { Filename: "B", Seed: [true, "0x2"] },
      Inventory: { Class: { InventoryClass: "A" } },
      Inventory_TechOnly: {},
      Inventory_Cargo: {},
      PlayerFreighterName: "Nova",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(listFreighters(result.json)[0]?.name).toBe("Nova");
  });

  it("lista fragatas com tipo e traits", () => {
    const items = listFrigates(
      save({
        FleetFrigates: [
          {
            CustomName: "Kunit",
            ResourceSeed: [true, "0x11"],
            FrigateClass: { FrigateClass: "Exploration" },
            InventoryClass: { InventoryClass: "S" },
            TraitIDs: ["a", "b", "c"],
          },
        ],
      }),
    );
    expect(items[0]).toMatchObject({
      name: "Kunit",
      itemType: "Exploration",
      className: "S",
      extra: { traits: "3" },
    });
  });

  it("lista bases com aviso quando Objects é grande", () => {
    const items = listBases(
      save({
        PersistentPlayerBases: [
          {
            Name: "Casa",
            GalacticAddress: 99,
            BaseType: { PersistentBaseTypes: "HomePlanetBase" },
            Objects: Array.from({ length: 70 }, () => ({ ObjectID: "x" })),
          },
        ],
      }),
    );
    expect(items[0]?.itemType).toBe("Planeta");
    expect(items[0]?.warning).toMatch(/grande/);
    expect(items[0]?.extra.objects).toBe("70");
  });

  it("separa FreighterBase das outras bases com rótulo Interior", () => {
    const json = save({
      PersistentPlayerBases: [
        {
          Name: "Casa",
          GalacticAddress: 1,
          BaseType: { PersistentBaseTypes: "HomePlanetBase" },
          Objects: [],
        },
        {
          Name: "",
          GalacticAddress: 2,
          BaseType: { PersistentBaseTypes: "FreighterBase" },
          Objects: [{ ObjectID: "a" }, { ObjectID: "b" }],
        },
        {
          Name: "Outra",
          GalacticAddress: 3,
          BaseType: { PersistentBaseTypes: "FreighterBase" },
          Objects: [{ ObjectID: "c" }],
        },
      ],
    });
    const all = listBases(json);
    const interior = listFreighterBases(json);
    expect(all).toHaveLength(3);
    expect(interior).toHaveLength(2);
    expect(interior.map((item) => item.slotLabel)).toEqual([
      "Interior 1",
      "Interior 2",
    ]);
    expect(interior[0]?.name).toBe("Base Cargueira");
    expect(interior[0]?.extra.objects).toBe("2");
    expect(interior[0]?.category).toBe("base");
  });

  it("wonders pessoais arquivam record+extra; automáticos são read-only", () => {
    const json = save({
      WonderCustomRecords: [
        { GenerationID: ["0x1", "0xAA"], WonderStatValue: 0 },
        { GenerationID: [false, "0x0"], WonderStatValue: 0 },
      ],
      WonderCustomRecordsExtraData: [
        { CustomName: "pessoa", ActualType: { WonderType: "Creature" } },
        { CustomName: "", ActualType: { WonderType: "Flora" } },
      ],
      WonderCreatureRecords: [
        { GenerationID: [true, "0xBB"], WonderStatValue: 12 },
      ],
    });
    const items = listWonders(json);
    const personal = items.filter((i) => i.group !== "automatic");
    const auto = items.filter((i) => i.group === "automatic");
    expect(personal[0]?.name).toBe("pessoa");
    expect(personal[1]?.empty).toBe(true);
    expect(auto[0]?.readonly).toBe(true);
    const inserted = insertWonder(json, {
      record: { GenerationID: [true, "0xCC"] },
      extra: { CustomName: "nova", ActualType: { WonderType: "Flora" } },
    });
    expect(inserted.ok).toBe(true);
    if (inserted.ok) expect(inserted.index).toBe(1);
  });
});

describe("insertItem fallback de seed", () => {
  it("substitui o mesmo seed quando não há vazio", () => {
    const json = save({ Pets: [filledPet] });
    const next = { ...filledPet, CustomName: "Nimbus 2" };
    const result = insertItem(json, "companion", next, "0xdf");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(listCompanions(result.json)[0]?.name).toBe("Nimbus 2");
  });
});
