import { describe, expect, it } from "vitest";
import { getPlayerState } from "@/lib/nms/player";
import { asArray, asNumber, asRecord } from "@/lib/nms/value";
import { shipCustomisationIndex } from "@/lib/nms/reorder";
import {
  EMPTY_SHIP_CUSTOMISATION,
  insertShip,
  isPackedShipPayload,
  listFilledShips,
  listShips,
  replaceShip,
  shipSeedFromPayload,
  shipsAdapter,
  clearShip,
} from "@/lib/nms/extract/ships";

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

  it("empacota ownership + visual na listagem e lê seed nos dois formatos", () => {
    const customisation = {
      SelectedPreset: "^",
      CustomData: {
        DescriptorGroups: ["^DROPS_COCKS13"],
        Colours: [{ Palette: "Paint" }],
        TextureOptions: [],
        BoneScales: [],
        Scale: 1,
      },
    };
    const hull = {
      Name: "Casco",
      BaseType: { PersistentBaseTypes: "PlayerShipBase" },
      UserData: 0,
      Objects: [{ UserData: 42, ObjectID: "^CV_COLOUR" }],
    };
    const json = {
      Version: 6783,
      BaseContext: {
        PlayerStateData: {
          ShipOwnership: [filled, emptySlot],
          CharacterCustomisationData: [
            emptyCcd(),
            emptyCcd(),
            emptyCcd(),
            customisation,
          ],
          PersistentPlayerBases: [
            hull,
            {
              Name: "Planeta",
              BaseType: { PersistentBaseTypes: "HomePlanetBase" },
              UserData: 0,
            },
          ],
        },
      },
    };
    const ships = listShips(json);
    expect(isPackedShipPayload(ships[0]?.payload)).toBe(true);
    const packed = ships[0]?.payload as {
      kind: string;
      ownership: { Name?: string };
      customisation?: { CustomData?: { DescriptorGroups?: string[] } };
      hull?: { UserData?: number; Objects?: { UserData?: number }[] };
    };
    expect(packed.kind).toBe("ship");
    expect(packed.ownership.Name).toBe("Golden Vector");
    expect(packed.customisation?.CustomData?.DescriptorGroups).toContain(
      "^DROPS_COCKS13",
    );
    expect(packed.hull?.UserData).toBe(0);
    expect(packed.hull?.Objects?.[0]?.UserData).toBe(42);
    expect(ships[1]?.payload).toEqual(emptySlot);
    expect(shipSeedFromPayload(packed)).toBe("0xabcdef");
    expect(shipSeedFromPayload(filled)).toBe("0xabcdef");
    expect(shipsAdapter.summarize(packed).name).toBe("Golden Vector");
    expect(shipsAdapter.summarize(filled).seed).toBe("0xabcdef");
  });
});

function emptyCcd() {
  return structuredClone(EMPTY_SHIP_CUSTOMISATION);
}

function filledNamed(name: string) {
  return {
    ...filled,
    Name: name,
    Resource: {
      ...filled.Resource,
      Seed: [true, "0x10"],
    },
  };
}

function twelveSlots(filledCount: number) {
  return Array.from({ length: 12 }, (_, i) =>
    i < filledCount ? filledNamed(`Nave ${i}`) : { ...emptySlot },
  );
}

function saveWithVisuals(player: Record<string, unknown>) {
  return {
    Version: 6783,
    BaseContext: { GameMode: 5, PlayerStateData: player },
  };
}

const vultureCustomisation = {
  SelectedPreset: "^",
  CustomData: {
    DescriptorGroups: ["^DROPS_COCKS13", "^DROPS_ENGIS13", "^DROPS_WINGS13"],
    FCx: "^",
    Colours: [{ Palette: { Palette: "Paint" } }],
    TextureOptions: [
      {
        TextureOptionGroupName: "^SHIP_FIGHT",
        TextureOptionName: "^STEALTH",
      },
    ],
    BoneScales: [],
    Scale: 1.0,
  },
};

function descriptorGroupsAt(json: unknown, shipIndex: number): string[] {
  const player = getPlayerState(json);
  const ccd = asArray(player?.CharacterCustomisationData);
  const ccdIndex = shipCustomisationIndex(shipIndex);
  if (!ccd || ccdIndex == null) return [];
  const data = asRecord(asRecord(ccd[ccdIndex])?.CustomData);
  return (asArray(data?.DescriptorGroups) ?? []).map(String);
}

function ownershipAt(json: unknown, index: number): Record<string, unknown> {
  const ships = asArray(getPlayerState(json)?.ShipOwnership) ?? [];
  return asRecord(ships[index]) ?? {};
}

function hullUserData(json: unknown): number[] {
  const bases = asArray(getPlayerState(json)?.PersistentPlayerBases) ?? [];
  return bases
    .filter(
      (slot) =>
        asStringType(slot) === "PlayerShipBase",
    )
    .map((slot) => asNumber(asRecord(slot)?.UserData) ?? -1);
}

function asStringType(slot: unknown): string {
  const rec = asRecord(slot);
  const nested = asRecord(rec?.BaseType);
  return typeof nested?.PersistentBaseTypes === "string"
    ? nested.PersistentBaseTypes
    : "";
}

describe("payload visual de nave", () => {
  it("insert em slot vazio aplica CCD no índice certo e remapeia UserData do casco", () => {
    const packed = {
      kind: "ship" as const,
      ownership: filledNamed("Vulture"),
      customisation: vultureCustomisation,
      hull: {
        Name: "Casco",
        BaseType: { PersistentBaseTypes: "PlayerShipBase" },
        UserData: 2,
        Objects: [{ UserData: 99, ObjectID: "^CV_COLOUR" }],
      },
    };

    const dest5 = insertShip(
      saveWithVisuals({
        ShipOwnership: twelveSlots(5),
        CharacterCustomisationData: Array.from({ length: 26 }, emptyCcd),
        PersistentPlayerBases: [],
      }),
      packed,
    );
    expect(dest5.ok).toBe(true);
    if (!dest5.ok) return;
    expect(dest5.index).toBe(5);
    expect(descriptorGroupsAt(dest5.json, 5)).toEqual([
      "^DROPS_COCKS13",
      "^DROPS_ENGIS13",
      "^DROPS_WINGS13",
    ]);
    expect(ownershipAt(dest5.json, 5).kind).toBeUndefined();
    expect(ownershipAt(dest5.json, 5).ownership).toBeUndefined();
    expect(asRecord(ownershipAt(dest5.json, 5).Resource)?.Filename).toContain(
      "FIGHTER_PROC",
    );
    const hull5 = asArray(
      getPlayerState(dest5.json)?.PersistentPlayerBases,
    )?.[0];
    expect(asNumber(asRecord(hull5)?.UserData)).toBe(5);
    expect(
      asNumber(asRecord(asArray(asRecord(hull5)?.Objects)?.[0])?.UserData),
    ).toBe(99);

    const dest6 = insertShip(
      saveWithVisuals({
        ShipOwnership: twelveSlots(6),
        CharacterCustomisationData: Array.from({ length: 26 }, emptyCcd),
      }),
      packed,
    );
    expect(dest6.ok).toBe(true);
    if (!dest6.ok) return;
    expect(dest6.index).toBe(6);
    expect(descriptorGroupsAt(dest6.json, 6)).toEqual([
      "^DROPS_COCKS13",
      "^DROPS_ENGIS13",
      "^DROPS_WINGS13",
    ]);
  });

  it("payload antigo ainda insere e limpa visual/casco do destino", () => {
    const leftoverCcd = Array.from({ length: 26 }, emptyCcd);
    leftoverCcd[4] = structuredClone(vultureCustomisation);
    const json = saveWithVisuals({
      ShipOwnership: twelveSlots(1),
      CharacterCustomisationData: leftoverCcd,
      PersistentPlayerBases: [
        {
          Name: "Casco alheio",
          BaseType: { PersistentBaseTypes: "PlayerShipBase" },
          UserData: 1,
          Objects: [{ UserData: 7 }],
        },
      ],
    });
    const ok = insertShip(json, {
      Name: "Imported",
      Resource: { Filename: "MODELS/X.SCENE.MBIN", Seed: [true, "0x1"] },
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.index).toBe(1);
    expect(ownershipAt(ok.json, 1).kind).toBeUndefined();
    expect(descriptorGroupsAt(ok.json, 1)).toEqual([]);
    expect(hullUserData(ok.json)).toEqual([]);
  });

  it("replace usa a mesma rotina e o wrapper não vaza para ShipOwnership", () => {
    const json = saveWithVisuals({
      ShipOwnership: twelveSlots(3),
      CharacterCustomisationData: Array.from({ length: 26 }, emptyCcd),
      PersistentPlayerBases: [
        {
          Name: "Velho",
          BaseType: { PersistentBaseTypes: "PlayerShipBase" },
          UserData: 1,
        },
      ],
    });
    const packed = {
      kind: "ship" as const,
      ownership: filledNamed("Nova"),
      customisation: vultureCustomisation,
      hull: {
        Name: "Novo casco",
        BaseType: { PersistentBaseTypes: "PlayerShipBase" },
        UserData: 8,
        Objects: [{ UserData: 3 }],
      },
    };
    const ok = replaceShip(json, 1, packed);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.index).toBe(1);
    expect(ownershipAt(ok.json, 1).kind).toBeUndefined();
    expect(ownershipAt(ok.json, 1).Name).toBe("Nova");
    expect(descriptorGroupsAt(ok.json, 1)).toEqual([
      "^DROPS_COCKS13",
      "^DROPS_ENGIS13",
      "^DROPS_WINGS13",
    ]);
    expect(hullUserData(ok.json)).toEqual([1]);
  });
});

describe("clearShip", () => {
  it("esvazia o slot, CCD e casco sem encolher o array", () => {
    const leftoverCcd = Array.from({ length: 26 }, emptyCcd);
    leftoverCcd[3] = structuredClone(vultureCustomisation);
    const json = saveWithVisuals({
      ShipOwnership: twelveSlots(3),
      CharacterCustomisationData: leftoverCcd,
      PersistentPlayerBases: [
        {
          Name: "Casco",
          BaseType: { PersistentBaseTypes: "PlayerShipBase" },
          UserData: 0,
          Objects: [{ UserData: 9 }],
        },
        {
          Name: "Planeta",
          BaseType: { PersistentBaseTypes: "HomePlanetBase" },
          UserData: 0,
        },
      ],
      PrimaryShip: 0,
      CorvetteEditAssociatedShipIndex: 0,
      ShipUsesLegacyColours: Array.from({ length: 12 }, () => false),
    });
    const ok = clearShip(json, 0);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const listed = listShips(ok.json);
    expect(listed).toHaveLength(12);
    expect(listed[0]?.empty).toBe(true);
    expect(listed[1]?.empty).toBe(false);
    expect(descriptorGroupsAt(ok.json, 0)).toEqual([]);
    expect(hullUserData(ok.json)).toEqual([]);
    const player = getPlayerState(ok.json);
    expect(player?.PrimaryShip).toBe(1);
    expect(player?.CorvetteEditAssociatedShipIndex).toBe(1);
    const planet = asArray(player?.PersistentPlayerBases)?.find(
      (slot) => asStringType(slot) === "HomePlanetBase",
    );
    expect(planet).toBeDefined();
  });
});
