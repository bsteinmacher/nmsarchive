import { describe, expect, it } from "vitest";
import { neighborSlots } from "@/lib/item-nav";
import type { ExtractedSlot } from "@/lib/nms/extract/types";

function slot(
  index: number,
  extra: Partial<ExtractedSlot> = {},
): ExtractedSlot {
  return {
    category: "companion",
    index,
    name: `Pet ${index + 1}`,
    seed: `0x${index + 1}`,
    className: "",
    itemType: "TREX",
    filename: "",
    empty: false,
    extra: {},
    payload: {},
    ...extra,
  };
}

describe("neighborSlots", () => {
  it("pula vazios e aponta prev/next", () => {
    const items = [
      slot(0),
      slot(1, { empty: true, name: "Slot 2 vazio", seed: "" }),
      slot(2),
    ];
    expect(neighborSlots(items, items[0])).toEqual({
      prev: null,
      next: items[2],
    });
    expect(neighborSlots(items, items[2])).toEqual({
      prev: items[0],
      next: null,
    });
  });

  it("ignora readonly", () => {
    const items = [slot(0, { readonly: true }), slot(1), slot(2)];
    expect(neighborSlots(items, items[1])).toEqual({
      prev: null,
      next: items[2],
    });
  });
});
