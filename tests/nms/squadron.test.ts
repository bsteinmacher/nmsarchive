import { describe, expect, it } from "vitest";
import { applyItem } from "@/lib/nms/extract";
import {
  clearSquadron,
  insertSquadron,
  listSquadronPilots,
  replaceSquadron,
  squadronAdapter,
} from "@/lib/nms/extract/squadron";
import { getPlayerState } from "@/lib/nms/player";

function save(player: Record<string, unknown>) {
  return { BaseContext: { PlayerStateData: player } };
}

function exotic(seed = "0xabc") {
  return {
    PilotRank: 3,
    NPCResource: {
      Filename: "MODELS/COMMON/PLAYER/PLAYERCHARACTER/NPCVYKEEN.SCENE.MBIN",
      Seed: [true, "0x111"],
    },
    ShipResource: {
      Filename: "MODELS/COMMON/SPACECRAFT/S-CLASS/S-CLASS_PROC.SCENE.MBIN",
      Seed: [true, seed],
    },
    TraitsSeed: "0x222",
  };
}

function emptyPilot() {
  return {
    PilotRank: 0,
    NPCResource: { Filename: "", Seed: [true, "0x0"] },
    ShipResource: { Filename: "", Seed: [true, "0x0"] },
    TraitsSeed: "0x0",
  };
}

function pilotsOf(json: unknown) {
  return getPlayerState(json)?.SquadronPilots as unknown[];
}

function flagsOf(json: unknown) {
  return getPlayerState(json)?.SquadronUnlockedPilotSlots;
}

describe("listSquadronPilots", () => {
  it("devolve vazio quando o save não tem o array", () => {
    expect(listSquadronPilots(save({}))).toEqual([]);
  });

  it("lista os quatro slots, inclusive vazio e bloqueado", () => {
    const items = listSquadronPilots(
      save({
        SquadronUnlockedPilotSlots: [false, true, false, true],
        SquadronPilots: [exotic(), exotic("0xdef"), emptyPilot(), emptyPilot()],
      }),
    );
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      category: "squadron",
      empty: false,
      name: "S-CLASS_PROC",
      className: "Ace",
      itemType: "Exotic",
      seed: "0xabc",
      extra: { rank: "Ace", itemType: "Exotic", race: "Vy'keen", unlocked: "false" },
    });
    expect(items[1]?.extra.unlocked).toBe("true");
    expect(items[2]).toMatchObject({
      empty: true,
      name: "Slot 3 vazio",
      extra: { unlocked: "false" },
    });
    expect(items[0]?.readonly).toBeUndefined();
    expect(items[0]?.payload).toMatchObject({
      kind: "squadron",
      unlocked: false,
    });
  });

  it("aceita rank aninhado e raça pelo enum", () => {
    const items = listSquadronPilots(
      save({
        SquadronPilots: [
          {
            PilotRank: { PilotRank: "Veteran" },
            PilotRace: { AlienRace: "Explorers" },
            ShipType: { ShipClass: "Dropship" },
            ShipResource: {
              Filename: "",
              Seed: [true, "0x0"],
            },
          },
        ],
      }),
    );
    expect(items[0]).toMatchObject({
      className: "Veteran",
      itemType: "Hauler",
      extra: { race: "Korvax", unlocked: "true" },
      empty: false,
    });
  });
});

describe("escrita do esquadrão", () => {
  const base = save({
    SquadronUnlockedPilotSlots: [true, false, false, false],
    SquadronPilots: [exotic(), emptyPilot(), emptyPilot(), emptyPilot()],
  });

  it("insere no primeiro vazio e marca o slot como liberado", () => {
    const result = insertSquadron(base, {
      kind: "squadron",
      unlocked: true,
      pilot: exotic("0x999"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.index).toBe(1);
    const listed = listSquadronPilots(result.json);
    expect(listed[1]).toMatchObject({ empty: false, seed: "0x999" });
    expect(flagsOf(result.json)).toEqual([true, true, false, false]);
  });

  it("recusa um quinto piloto", () => {
    const full = save({
      SquadronUnlockedPilotSlots: [true, true, true, true],
      SquadronPilots: [exotic(), exotic("0x2"), exotic("0x3"), exotic("0x4")],
    });
    const result = insertSquadron(full, exotic("0x5"));
    expect(result).toMatchObject({ ok: false });
    const applied = applyItem(full, "squadron", exotic("0x5"));
    expect(applied.ok).toBe(false);
  });

  it("substitui o piloto e o flag do índice", () => {
    const result = replaceSquadron(base, 0, {
      kind: "squadron",
      unlocked: false,
      pilot: exotic("0x777"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(listSquadronPilots(result.json)[0]?.seed).toBe("0x777");
    expect(flagsOf(result.json)).toEqual([false, false, false, false]);
  });

  it("esvazia o slot e bloqueia", () => {
    const result = clearSquadron(base, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(listSquadronPilots(result.json)[0]?.empty).toBe(true);
    expect(flagsOf(result.json)).toEqual([false, false, false, false]);
    const ship = (pilotsOf(result.json)[0] as { ShipResource: { Filename: string } })
      .ShipResource;
    expect(ship.Filename).toBe("");
  });

  it("reordena piloto e liberação juntos", () => {
    const result = squadronAdapter.reorder?.(base, 0, 1);
    expect(result?.ok).toBe(true);
    if (!result?.ok) return;
    const listed = listSquadronPilots(result.json);
    expect(listed[0]?.empty).toBe(true);
    expect(listed[1]?.seed).toBe("0xabc");
    expect(flagsOf(result.json)).toEqual([false, true, false, false]);
  });
});
