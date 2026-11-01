import { describe, expect, it } from "vitest";
import {
  archiveHref,
  CATEGORIES,
  CATEGORY_META,
  isCategory,
  REORDERABLE_CATEGORIES,
  saveHref,
  SIDEBAR_CATEGORIES,
} from "@/types/nms";

describe("categories", () => {
  it("keeps the archive menu order", () => {
    expect([...CATEGORIES]).toEqual([
      "exosuit",
      "multitool",
      "companion",
      "ship",
      "freighter",
      "frigate",
      "squadron",
      "base",
      "deepspace",
      "spacestation",
      "wonder",
    ]);
  });

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
    expect(isCategory("deepspace")).toBe(true);
    expect(isCategory("spacestation")).toBe(true);
    expect(isCategory("squadron")).toBe(true);
    expect(isCategory("WeaponOwnership")).toBe(false);
    expect(isCategory("inventory")).toBe(false);
    expect(isCategory("")).toBe(false);
  });

  it("does not treat inventory as an archive category", () => {
    expect((CATEGORIES as readonly string[]).includes("inventory")).toBe(false);
  });

  it("marks ships, multitools, companions and squadron as reorderable", () => {
    expect([...REORDERABLE_CATEGORIES]).toEqual([
      "ship",
      "multitool",
      "companion",
      "squadron",
    ]);
  });

  it("builds archive hrefs", () => {
    expect(archiveHref()).toBe("/");
    expect(archiveHref("ship")).toBe("/archive/ship");
    expect(archiveHref("frigate")).toBe("/archive/frigate");
    expect(archiveHref("squadron")).toBe("/archive/squadron");
    expect(archiveHref("deepspace")).toBe("/archive/base");
    expect(archiveHref("spacestation")).toBe("/archive/base");
    expect(saveHref("frigate")).toBe("/frigate");
    expect(saveHref("squadron")).toBe("/squadron");
    expect(saveHref("deepspace")).toBe("/base");
    expect([...SIDEBAR_CATEGORIES]).toEqual([
      "exosuit",
      "multitool",
      "companion",
      "ship",
      "freighter",
      "frigate",
      "squadron",
      "base",
      "wonder",
    ]);
  });
});
