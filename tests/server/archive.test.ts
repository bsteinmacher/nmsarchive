import { afterAll, describe, expect, it } from "vitest";
import {
  archiveItem,
  countItemsByCategory,
  createSaveMetadata,
  deleteItem,
  getItem,
  listItems,
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

    const listed = await listItems(prisma, "ship");
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

    const listedFreighters = await listItems(prisma, "freighter");
    expect(listedFreighters.some((row) => row.id === interior.id)).toBe(true);
    expect(listedFreighters.some((row) => row.id === freighter.id)).toBe(true);
    expect(listedFreighters.some((row) => row.id === planet.id)).toBe(false);

    const listedBases = await listItems(prisma, "base");
    expect(listedBases.some((row) => row.id === interior.id)).toBe(false);
    expect(listedBases.some((row) => row.id === planet.id)).toBe(true);

    const counts = await countItemsByCategory(prisma);
    expect(counts.freighter ?? 0).toBeGreaterThanOrEqual(2);
    expect(listedBases).toHaveLength(counts.base ?? 0);

    await deleteItem(prisma, interior.id);
    await deleteItem(prisma, planet.id);
    await deleteItem(prisma, freighter.id);
  });
});
