import { describe, expect, it } from "vitest";
import {
  allViewColumns,
  dataColumns,
  pickListExtra,
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

  it("freighter, frigate, squadron e base usam as colunas do próprio adapter", () => {
    expect(dataColumns("freighter").map((col) => col.header)).toEqual([
      "Class",
      "Type",
    ]);
    expect(dataColumns("frigate").map((col) => col.header)).toEqual([
      "Class",
      "Type",
      "Traits",
    ]);
    expect(dataColumns("squadron").map((col) => col.header)).toEqual([
      "Rank",
      "Type",
      "Race",
    ]);
    expect(dataColumns("base").map((col) => col.header)).toEqual([
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
    expect(tableTagLabels(frigate, dataColumns("frigate"))).toEqual([
      "Expedition",
      "Living Frigate",
    ]);

    const interior = summary({
      category: "base",
      className: "",
      shipType: "Freighter",
      extra: { objects: "687" },
      tags: ["256 · Odyalutai", "687 objects", "Freighter"],
    });
    expect(tableTagLabels(interior, dataColumns("base"))).toEqual([
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
