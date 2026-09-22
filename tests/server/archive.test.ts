import { afterAll, describe, expect, it } from "vitest";
import {
  archiveItem,
  countItemsByCategory,
  createSaveMetadata,
  deleteItem,
  getItem,
  listItems,
  listTags,
  updateItem,
} from "@/server/archive-service";
import { createTestPrisma } from "../helpers/prisma";

const { prisma } = createTestPrisma();

afterAll(async () => {
  await prisma.$disconnect();
});

const payload = {
  Name: "Horizon Vector",
  Resource: {
    Filename: "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTER_PROC.SCENE.MBIN",
    Seed: [true, "0xABCDEF"],
  },
};

describe("archive-service", () => {
  it("arquiva, lista, atualiza tags, lê payload e registra o log", async () => {
    const { save } = await createSaveMetadata(prisma, {
      fileName: "save2.hg",
      platform: "Win|Final",
      gameVersion: 6783,
      formatHint: "lz4",
      saveName: "Test",
      galaxy: 255,
      playTimeSec: 3600,
      sha256: "a".repeat(64),
    });
    expect(save.id).toBeTruthy();

    const same = await createSaveMetadata(prisma, {
      fileName: "save2-copy.hg",
      platform: "Win|Final",
      sha256: "a".repeat(64),
    });
    expect(same.created).toBe(false);
    expect(same.save.id).toBe(save.id);

    const archived = await archiveItem(prisma, {
      category: "ship",
      name: "Horizon Vector",
      seed: "0xABCDEF",
      description: "Fighter do save de teste.",
      metadata: {
        gameVersion: 6783,
        className: "S",
        shipType: "Fighter",
        filename: "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTER_PROC.SCENE.MBIN",
        payload,
      },
      galaxy: 255,
      sourceSaveId: save.id,
      tags: ["fighter", "S-class"],
    });
    expect(archived.shipType).toBe("Fighter");
    expect(archived.tags.map((t) => t.slug).sort()).toEqual([
      "fighter",
      "s-class",
    ]);

    const listed = await listItems(prisma, { category: "ship" });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(archived.id);

    const detail = await getItem(prisma, archived.id);
    expect(detail.payload).toEqual(payload);

    const updated = await updateItem(prisma, {
      id: archived.id,
      description: "Atualizada.",
      tags: ["exotic"],
    });
    expect(updated.description).toBe("Atualizada.");
    expect(updated.tags.map((t) => t.slug)).toEqual(["exotic"]);

    await deleteItem(prisma, archived.id);
    await expect(getItem(prisma, archived.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const logs = await prisma.operationLog.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.action)).toEqual([
      "save_create",
      "archive",
      "update",
      "delete",
    ]);
  });

  it("aceita as categorias arquiváveis da Fase 3", async () => {
    const archived = await archiveItem(prisma, {
      category: "multitool",
      name: "Atlas Sceptre",
      seed: "0x1",
      description: "staff atlas",
      metadata: { gameVersion: 1, shipType: "Atlas Staff", payload: {} },
      tags: [],
    });
    expect(archived.category).toBe("multitool");
    expect(archived.shipType).toBe("Atlas Staff");
  });

  it("guarda Atk/Agi/HP do companion no metadata, sem mexer no payload", async () => {
    const archived = await archiveItem(prisma, {
      category: "companion",
      name: "Sodelle",
      seed: "0x3c",
      description: "pet da arena",
      metadata: {
        gameVersion: 1,
        extra: { biome: "Radioactive", element: "Radioativo" },
        payload: { CreatureSeed: [true, "0x3c"] },
      },
      tags: [],
    });
    expect(archived.extra).toMatchObject({
      biome: "Radioactive",
      element: "Radioativo",
    });
    const updated = await updateItem(prisma, {
      id: archived.id,
      className: "S/S/S",
      extra: {
        biome: "Radioactive",
        element: "Radioativo",
        rank: "S/S/S",
        atk: "S",
        agi: "S",
        hp: "S",
      },
    });
    expect(updated.className).toBe("S/S/S");
    expect(updated.extra).toMatchObject({
      biome: "Radioactive",
      element: "Radioativo",
    });
    const detail = await getItem(prisma, archived.id);
    expect(detail.metadata.extra).toMatchObject({ rank: "S/S/S", atk: "S" });
    expect(detail.payload).toEqual({ CreatureSeed: [true, "0x3c"] });
  });

  it("expõe identitySeed do payload mesmo com CreatureSeed 0x0", async () => {
    const archived = await archiveItem(prisma, {
      category: "companion",
      name: "UI_FIEND_NAME",
      seed: "0x0",
      description: "fiend do teste",
      metadata: {
        gameVersion: 1,
        payload: {
          CreatureID: "^FIEND",
          CreatureSeed: [false, "0x0"],
          SpeciesSeed: 1,
          GenusSeed: 1,
        },
      },
      tags: [],
    });
    expect(archived.identitySeed).toMatch(/^0x[0-9a-f]+$/);
    expect(archived.identitySeed).not.toBe("0x0");
    const listed = await listItems(prisma, { category: "companion" });
    expect(listed.find((item) => item.id === archived.id)?.identitySeed).toBe(
      archived.identitySeed,
    );
  });

  it("lista FreighterBase em cargueiras, não em bases", async () => {
    const interior = await archiveItem(prisma, {
      category: "base",
      name: "Base Cargueira",
      seed: "0x79ff",
      description: "interior da frota",
      metadata: {
        gameVersion: 1,
        shipType: "Cargueira",
        extra: { baseType: "FreighterBase", objects: "616" },
        payload: { BaseType: { PersistentBaseTypes: "FreighterBase" } },
      },
      tags: [],
    });
    const planet = await archiveItem(prisma, {
      category: "base",
      name: "Casa",
      seed: "0x11",
      description: "base planetária",
      metadata: {
        gameVersion: 1,
        shipType: "Planeta",
        extra: { baseType: "HomePlanetBase" },
        payload: {},
      },
      tags: [],
    });
    const freighter = await archiveItem(prisma, {
      category: "freighter",
      name: "Omen",
      seed: "0xab",
      description: "cargueira atual",
      metadata: { gameVersion: 1, shipType: "Pirate", payload: { kind: "current" } },
      tags: [],
    });

    const listedFreighters = await listItems(prisma, { category: "freighter" });
    expect(listedFreighters.some((row) => row.id === interior.id)).toBe(true);
    expect(listedFreighters.some((row) => row.id === freighter.id)).toBe(true);
    expect(listedFreighters.some((row) => row.id === planet.id)).toBe(false);

    const listedBases = await listItems(prisma, { category: "base" });
    expect(listedBases.some((row) => row.id === interior.id)).toBe(false);
    expect(listedBases.some((row) => row.id === planet.id)).toBe(true);

    const counts = await countItemsByCategory(prisma);
    expect(counts.freighter ?? 0).toBeGreaterThanOrEqual(2);
    expect(listedBases).toHaveLength(counts.base ?? 0);

    await deleteItem(prisma, interior.id);
    await deleteItem(prisma, planet.id);
    await deleteItem(prisma, freighter.id);
  });

  it("lista Deep Space e Space Station COSMOS, inclusive itens velhos category=base", async () => {
    const oldDeep = await archiveItem(prisma, {
      category: "base",
      name: "Orbital antiga",
      seed: "0xaaa1",
      description: "arquivada como base antes da 4b",
      metadata: {
        gameVersion: 6785,
        shipType: "PlayerSpaceBase",
        extra: { baseType: "PlayerSpaceBase", objects: "40" },
        payload: { BaseType: { PersistentBaseTypes: "PlayerSpaceBase" } },
      },
      tags: [],
    });
    const newDeep = await archiveItem(prisma, {
      category: "deepspace",
      name: "Orbital nova",
      seed: "0xaaa2",
      description: "envelope deepspace",
      metadata: {
        gameVersion: 6785,
        shipType: "Deep Space",
        extra: { baseType: "PlayerSpaceBase" },
        payload: { BaseType: { PersistentBaseTypes: "PlayerSpaceBase" } },
      },
      tags: [],
    });
    const oldStation = await archiveItem(prisma, {
      category: "base",
      name: "Estação antiga",
      seed: "0xbbb1",
      description: "arquivada como base",
      metadata: {
        gameVersion: 6785,
        extra: { baseType: "PlayerSpaceStationBase", objects: "200" },
        payload: {
          BaseType: { PersistentBaseTypes: "PlayerSpaceStationBase" },
        },
      },
      tags: [],
    });
    const planet = await archiveItem(prisma, {
      category: "base",
      name: "Casa",
      seed: "0x11",
      description: "planetária",
      metadata: {
        gameVersion: 1,
        shipType: "Planeta",
        extra: { baseType: "HomePlanetBase" },
        payload: {},
      },
      tags: [],
    });

    const listedDeep = await listItems(prisma, { category: "deepspace" });
    expect(listedDeep.some((row) => row.id === oldDeep.id)).toBe(true);
    expect(listedDeep.some((row) => row.id === newDeep.id)).toBe(true);
    expect(listedDeep.some((row) => row.id === planet.id)).toBe(false);

    const listedStation = await listItems(prisma, { category: "spacestation" });
    expect(listedStation.some((row) => row.id === oldStation.id)).toBe(true);
    expect(listedStation.some((row) => row.id === planet.id)).toBe(false);

    const listedBases = await listItems(prisma, { category: "base" });
    expect(listedBases.some((row) => row.id === planet.id)).toBe(true);
    expect(listedBases.some((row) => row.id === oldDeep.id)).toBe(false);
    expect(listedBases.some((row) => row.id === oldStation.id)).toBe(false);

    const counts = await countItemsByCategory(prisma);
    expect(counts.deepspace ?? 0).toBeGreaterThanOrEqual(2);
    expect(counts.spacestation ?? 0).toBeGreaterThanOrEqual(1);
    expect(listedBases).toHaveLength(counts.base ?? 0);

    await deleteItem(prisma, oldDeep.id);
    await deleteItem(prisma, newDeep.id);
    await deleteItem(prisma, oldStation.id);
    await deleteItem(prisma, planet.id);
  });

  it("filtra S-class + tag exotic e ignora o resto", async () => {
    const hit = await archiveItem(prisma, {
      category: "ship",
      name: "Golden Vector",
      seed: "0xaaa",
      description: "exotic de teste",
      metadata: {
        gameVersion: 1,
        className: "S",
        shipType: "Exotic",
        payload: {},
      },
      galaxy: 0,
      tags: ["exotic", "keeper"],
    });
    const missClass = await archiveItem(prisma, {
      category: "ship",
      name: "Hauler",
      seed: "0xbbb",
      description: "também exotic",
      metadata: {
        gameVersion: 1,
        className: "A",
        shipType: "Hauler",
        payload: {},
      },
      tags: ["exotic"],
    });
    const missTag = await archiveItem(prisma, {
      category: "ship",
      name: "Fighter S",
      seed: "0xccc",
      description: "S sem a tag",
      metadata: {
        gameVersion: 1,
        className: "S",
        shipType: "Fighter",
        payload: {},
      },
      tags: ["fighter"],
    });

    const filtered = await listItems(prisma, {
      category: "ship",
      className: "S",
      tags: ["exotic"],
    });
    expect(filtered.map((row) => row.id)).toEqual([hit.id]);

    const byText = await listItems(prisma, { q: "golden" });
    expect(byText.map((row) => row.id)).toEqual([hit.id]);

    const byGalaxy = await listItems(prisma, { galaxy: 0 });
    expect(byGalaxy.some((row) => row.id === hit.id)).toBe(true);
    expect(byGalaxy.some((row) => row.id === missClass.id)).toBe(false);

    const tags = await listTags(prisma, "exo");
    expect(tags.some((t) => t.slug === "exotic")).toBe(true);

    await deleteItem(prisma, hit.id);
    await deleteItem(prisma, missClass.id);
    await deleteItem(prisma, missTag.id);
  });

  it("guarda screenshotPath no resumo", async () => {
    const path = "22222222-2222-4222-8222-222222222222.webp";
    const archived = await archiveItem(prisma, {
      category: "ship",
      name: "Com foto",
      seed: "0xddd",
      description: "tem screenshot",
      metadata: { gameVersion: 1, className: "S", shipType: "Fighter", payload: {} },
      tags: [],
      screenshotPath: path,
    });
    expect(archived.screenshotPath).toBe(path);
    const listed = await listItems(prisma, { category: "ship" });
    expect(listed.find((row) => row.id === archived.id)?.screenshotPath).toBe(
      path,
    );
    await deleteItem(prisma, archived.id);
  });

  it("não lista FreighterBase em bases mesmo com filtro de tag", async () => {
    const interior = await archiveItem(prisma, {
      category: "base",
      name: "Interior tagged",
      seed: "0xee",
      description: "exotic interior",
      metadata: {
        gameVersion: 1,
        shipType: "Cargueira",
        extra: { baseType: "FreighterBase" },
        payload: {},
      },
      tags: ["exotic"],
    });
    const filteredBase = await listItems(prisma, {
      category: "base",
      tags: ["exotic"],
    });
    expect(filteredBase.some((row) => row.id === interior.id)).toBe(false);
    const filteredFreighter = await listItems(prisma, {
      category: "freighter",
      tags: ["exotic"],
    });
    expect(filteredFreighter.some((row) => row.id === interior.id)).toBe(true);
    await deleteItem(prisma, interior.id);
  });
});
