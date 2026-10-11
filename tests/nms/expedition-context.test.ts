import { describe, expect, it } from "vitest";
import { insertShip, listShips } from "@/lib/nms/extract/ships";
import {
  getPlayerState,
  hasExpeditionContext,
  initialSaveContext,
  summarizePlayer,
} from "@/lib/nms/player";
import { setPlayerCurrencies } from "@/lib/nms/write";
import { asArray, asRecord } from "@/lib/nms/value";

const emptySlot = {
  Name: "",
  Resource: { Filename: "", Seed: [false, "0x0"] },
};

function ship(name: string) {
  return {
    Name: name,
    Resource: {
      Filename: "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTER_PROC.SCENE.MBIN",
      Seed: [true, "0x1"],
    },
  };
}

function saveWithExpedition(activeContext: string) {
  return {
    Version: 6785,
    Platform: "Win|Final",
    ActiveContext: activeContext,
    CommonStateData: { SaveName: "Traveller", TotalPlayTime: 100 },
    BaseContext: {
      GameMode: 5,
      PlayerStateData: {
        Units: 10,
        Nanites: 1,
        Specials: 2,
        SaveSummary: "main system",
        UniverseAddress: { RealityIndex: 0 },
        ShipOwnership: [ship("Main Ship"), emptySlot],
      },
    },
    ExpeditionContext: {
      GameMode: 6,
      PlayerStateData: {
        Units: 99,
        Nanites: 3,
        Specials: 4,
        SaveSummary: "expedition system",
        UniverseAddress: { RealityIndex: 2 },
        ShipOwnership: [emptySlot, ship("Expo Ship")],
      },
    },
  };
}

describe("expedition context", () => {
  it("abre na expedição quando ActiveContext não é Main", () => {
    const json = saveWithExpedition("Expedition");
    expect(hasExpeditionContext(json)).toBe(true);
    expect(initialSaveContext(json)).toBe("expedition");
    expect(initialSaveContext(saveWithExpedition("Season"))).toBe("expedition");
    expect(initialSaveContext(saveWithExpedition("Main"))).toBe("main");
  });

  it("fica no principal quando não há ExpeditionContext", () => {
    const json = {
      ActiveContext: "Expedition",
      BaseContext: {
        GameMode: 5,
        PlayerStateData: { Units: 10, ShipOwnership: [] },
      },
    };
    expect(hasExpeditionContext(json)).toBe(false);
    expect(initialSaveContext(json)).toBe("main");
    expect(summarizePlayer(json).units).toBe(10);
  });

  it("resume e lista só o contexto pedido", () => {
    const json = saveWithExpedition("Expedition");
    expect(summarizePlayer(json)).toMatchObject({
      units: 10,
      gameMode: 5,
      gameModeLabel: "Permadeath",
      saveSummary: "main system",
      galaxy: 0,
      shipCount: 1,
    });
    expect(summarizePlayer(json, "expedition")).toMatchObject({
      units: 99,
      gameMode: 6,
      gameModeLabel: "Seasonal",
      saveSummary: "expedition system",
      galaxy: 2,
      shipCount: 1,
    });
    expect(listShips(json).map((slot) => slot.name)).toEqual([
      "Main Ship",
      "Slot 2 vazio",
    ]);
    expect(listShips(json, "expedition").map((slot) => slot.name)).toEqual([
      "Slot 1 vazio",
      "Expo Ship",
    ]);
  });

  it("insere e altera moedas na expedição sem mexer no principal", () => {
    const json = saveWithExpedition("Main");
    const inserted = insertShip(json, ship("Reward Ship"), "expedition");
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;

    const mainShips = asArray(getPlayerState(inserted.json)?.ShipOwnership);
    const expoShips = asArray(
      getPlayerState(inserted.json, "expedition")?.ShipOwnership,
    );
    expect(asRecord(mainShips?.[0])?.Name).toBe("Main Ship");
    expect(asRecord(mainShips?.[1])?.Name).toBe("");
    expect(asRecord(expoShips?.[0])?.Name).toBe("Reward Ship");
    expect(asRecord(expoShips?.[1])?.Name).toBe("Expo Ship");

    const coins = setPlayerCurrencies(inserted.json, { units: 50 }, "expedition");
    expect(coins.ok).toBe(true);
    if (!coins.ok) return;
    expect(getPlayerState(coins.json)?.Units).toBe(10);
    expect(getPlayerState(coins.json, "expedition")?.Units).toBe(50);
  });
});
