import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_META, isCategory } from "@/types/nms";

describe("categories", () => {
  it("covers every CATEGORIES entry in CATEGORY_META", () => {
    expect(Object.keys(CATEGORY_META).sort()).toEqual([...CATEGORIES].sort());
  });

  it("gives each category a matching href", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_META[category].href).toBe(`/${category}`);
      expect(CATEGORY_META[category].label.length).toBeGreaterThan(0);
    }
  });

  it("narrows known slugs and rejects unknown ones", () => {
    expect(isCategory("ship")).toBe(true);
    expect(isCategory("wonder")).toBe(true);
    expect(isCategory("WeaponOwnership")).toBe(false);
    expect(isCategory("")).toBe(false);
  });
});
