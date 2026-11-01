import { describe, expect, it } from "vitest";
import {
  allViewColumns,
  dataColumns,
  freighterGroupColumns,
  pickListExtra,
  saveBaseColumns,
  saveFreighterColumns,
  tableTagLabels,
} from "@/lib/list-columns";
import type { ArchivedItemSummary } from "@/types/archive";

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

  it("freighters, base e fragatas compartilham a mesma grade", () => {
    const widths = (category: "freighter" | "base" | "frigate") =>
      freighterGroupColumns(category).map((col) => col.id);
    expect(widths("freighter")).toEqual(["className", "itemType", "traits"]);
    expect(widths("base")).toEqual(["className", "itemType", "objects"]);
    expect(widths("frigate")).toEqual(["className", "itemType", "traits"]);
    expect(freighterGroupColumns("freighter")[2]?.reserved).toBe(true);
    expect(freighterGroupColumns("base")[0]?.reserved).toBe(true);
    expect(freighterGroupColumns("frigate").some((col) => col.reserved)).toBe(
      false,
    );
  });

  it("o save aberto alinha freighters e bases na mesma grade", () => {
    expect(saveFreighterColumns("freighter").map((col) => col.id)).toEqual([
      "className",
      "itemType",
      "traits",
    ]);
    expect(saveFreighterColumns("base")[0]?.reserved).toBe(true);
    expect(saveFreighterColumns("frigate")[2]?.reserved).toBeUndefined();
    expect(saveFreighterColumns("squadron").map((col) => col.header)).toEqual([
      "Rank",
      "Type",
      "Race",
    ]);
    expect(saveFreighterColumns("squadron").some((col) => col.reserved)).toBe(
      false,
    );
    expect(saveBaseColumns().map((col) => col.header)).toEqual([
      "Type",
      "Objects",
    ]);
  });

  it("a tabela não repete classe, tipo, categoria nem objects", () => {
    const frigate = summary({
      category: "frigate",
      className: "S",
      shipType: "Leviathan",
      tags: ["S Class", "Leviathan", "Frigate", "Expedition", "Living Frigate"],
    });
    expect(
      tableTagLabels(frigate, freighterGroupColumns("frigate")),
    ).toEqual(["Expedition", "Living Frigate"]);

    const interior = summary({
      category: "base",
      className: "",
      shipType: "Freighter",
      extra: { objects: "687" },
      tags: ["256 · Odyalutai", "687 objects", "Freighter"],
    });
    expect(tableTagLabels(interior, freighterGroupColumns("base"))).toEqual([
      "256 · Odyalutai",
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

function summary(
  partial: Pick<ArchivedItemSummary, "category" | "className" | "shipType"> & {
    tags: string[];
    extra?: ArchivedItemSummary["extra"];
  },
): ArchivedItemSummary {
  return {
    id: "1",
    name: "Item",
    seed: "",
    description: "",
    notes: "",
    galaxy: null,
    coordinates: null,
    gameVersion: null,
    filename: "",
    screenshotPath: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
    tags: partial.tags.map((label) => ({ slug: label, label })),
  };
}
