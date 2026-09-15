import { describe, expect, it } from "vitest";
import { matchingShips } from "@/lib/archive-match";
import type { ExtractedShip } from "@/lib/nms/extract/types";

function ship(partial: Partial<ExtractedShip> & Pick<ExtractedShip, "index" | "seed">): ExtractedShip {
  return {
    category: "ship",
    name: "X",
    extra: {},
    payload: {},
    className: "S",
    filename: "FIGHTER_PROC",
    shipType: "Fighter",
    empty: false,
    ...partial,
  };
}

describe("matchingShips", () => {
  it("acha o mesmo seed+category e ignora vazio", () => {
    const ships = [
      ship({ index: 0, seed: "0xabc", empty: true, name: "Slot 1 vazio" }),
      ship({ index: 1, seed: "0xABC" }),
      ship({ index: 2, seed: "0xdef" }),
    ];
    const hits = matchingShips(ships, "0xabc", "ship");
    expect(hits.map((s) => s.index)).toEqual([1]);
  });
});
