import { describe, expect, it } from "vitest";
import { listSquadronPilots } from "@/lib/nms/extract/squadron";

function save(player: Record<string, unknown>) {
  return { BaseContext: { PlayerStateData: player } };
}

describe("listSquadronPilots", () => {
  it("omite a seção quando não há filename de nave", () => {
    expect(
      listSquadronPilots(
        save({
          SquadronPilots: [{ PilotRank: { PilotRank: "Ace" } }],
        }),
      ),
    ).toEqual([]);
  });

  it("lista piloto com tipo da nave e rank, só leitura", () => {
    const items = listSquadronPilots(
      save({
        SquadronPilots: [
          {
            PilotRank: { PilotRank: "Ace" },
            ShipResource: {
              Filename:
                "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTER_PROC.SCENE.MBIN",
              Seed: [true, "0xabc"],
            },
          },
        ],
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.readonly).toBe(true);
    expect(items[0]?.group).toBe("squadron");
    expect(items[0]?.itemType).toBe("Fighter");
    expect(items[0]?.className).toBe("Ace");
    expect(items[0]?.empty).toBe(false);
  });
});
