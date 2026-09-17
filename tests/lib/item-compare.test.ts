import { describe, expect, it } from "vitest";
import {
  jsonDiff,
  jsonDiffHasChanges,
  shallowItemDiff,
} from "@/lib/item-compare";

describe("shallowItemDiff", () => {
  it("marca seed/classe/tipo iguais e diferentes", () => {
    const rows = shallowItemDiff(
      { seed: "0xABC", className: "S", itemType: "Fighter" },
      { seed: "0xabc", className: "A", itemType: "Fighter" },
    );
    expect(rows.find((r) => r.field === "seed")?.match).toBe(true);
    expect(rows.find((r) => r.field === "className")?.match).toBe(false);
    expect(rows.find((r) => r.field === "itemType")?.match).toBe(true);
  });
});

describe("jsonDiff", () => {
  it("acha chave só de um lado e valor mudado", () => {
    const diff = jsonDiff(
      { Name: "A", Seed: "0x1" },
      { Name: "B", Extra: true },
    );
    expect(jsonDiffHasChanges(diff)).toBe(true);
    const kids = diff.children ?? [];
    expect(kids.find((c) => c.key === "Name")?.kind).toBe("changed");
    expect(kids.find((c) => c.key === "Seed")?.kind).toBe("only-archived");
    expect(kids.find((c) => c.key === "Extra")?.kind).toBe("only-save");
  });

  it("trata payloads iguais como same", () => {
    const diff = jsonDiff({ n: 1 }, { n: 1 });
    expect(diff.kind).toBe("same");
    expect(jsonDiffHasChanges(diff)).toBe(false);
  });
});
