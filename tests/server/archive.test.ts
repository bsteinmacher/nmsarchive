import { afterAll, describe, expect, it } from "vitest";
import {
  archiveItem,
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

  it("recusa categoria que não é nave", async () => {
    await expect(
      archiveItem(prisma, {
        category: "multitool",
        name: "MT",
        seed: "0x1",
        description: "ainda não",
        metadata: { gameVersion: 1, payload: {} },
        tags: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
