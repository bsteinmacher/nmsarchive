import { describe, expect, it } from "vitest";
import {
  allViewColumns,
  dataColumns,
  pickListExtra,
} from "@/lib/list-columns";

describe("list-columns", () => {
  it("ships e multi tools compartilham Type, sem seed", () => {
    expect(dataColumns("ship").map((col) => col.header)).toEqual([
      "Class",
      "Type",
    ]);
    expect(dataColumns("multitool").map((col) => col.header)).toEqual([
      "Class",
      "Type",
    ]);
  });

  it("companions no arquivo ganham Class e bases não têm Class vazia", () => {
    expect(dataColumns("companion").map((col) => col.header)).toEqual([
      "Class",
      "Level",
      "Element",
      "Biome",
    ]);
    expect(dataColumns("base").map((col) => col.id)).toEqual([
      "itemType",
      "objects",
    ]);
  });

  it("All mostra categoria, tipo e classe", () => {
    expect(allViewColumns().map((col) => col.header)).toEqual([
      "Category",
      "Type",
      "Class",
    ]);
  });

  it("copia traits, objects e os campos do exosuit para a lista", () => {
    expect(
      pickListExtra({
        traits: "4",
        objects: "12",
        slots: "48",
        tech: "6",
        supercharged: "1",
        seed: "0x1",
      }),
    ).toEqual({
      traits: "4",
      objects: "12",
      slots: "48",
      tech: "6",
      supercharged: "1",
    });
  });
});
