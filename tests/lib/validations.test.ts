import { describe, expect, it } from "vitest";
import { parseTagInput, slugifyTag } from "@/lib/validations";
import { archiveItemInputSchema, saveMetadataInputSchema } from "@/lib/validations";
import { sha256Hex } from "@/lib/sha256";

describe("validations", () => {
  it("slugifyTag normaliza acento e espaço", () => {
    expect(slugifyTag(" S-class Exotic ")).toBe("s-class-exotic");
    expect(slugifyTag("Íon")).toBe("ion");
  });

  it("parseTagInput deduplica e ignora vazios", () => {
    expect(parseTagInput("exotic, Exotic,  ,s-class")).toEqual([
      "exotic",
      "s-class",
    ]);
  });

  it("description é obrigatória no archive", () => {
    const parsed = archiveItemInputSchema.safeParse({
      category: "ship",
      name: "X",
      seed: "0xabc",
      description: "   ",
      metadata: { gameVersion: 1, payload: {} },
    });
    expect(parsed.success).toBe(false);
  });

  it("screenshotPath no archive só aceita UUID.webp", () => {
    const bad = archiveItemInputSchema.safeParse({
      category: "ship",
      name: "X",
      seed: "0xabc",
      description: "ok",
      metadata: { gameVersion: 1, payload: {} },
      screenshotPath: "../secret.webp",
    });
    expect(bad.success).toBe(false);
    const good = archiveItemInputSchema.safeParse({
      category: "ship",
      name: "X",
      seed: "0xabc",
      description: "ok",
      metadata: { gameVersion: 1, payload: {} },
      screenshotPath: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp",
    });
    expect(good.success).toBe(true);
  });

  it("sha256 do createMetadata precisa ser 64 hex", () => {
    const bad = saveMetadataInputSchema.safeParse({
      fileName: "save.hg",
      platform: "Win|Final",
      sha256: "abc",
    });
    expect(bad.success).toBe(false);
  });
});

describe("sha256Hex", () => {
  it("calcula SHA-256 hex minúsculo estável", async () => {
    const hex = await sha256Hex(new TextEncoder().encode("nmsarchive"));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex(new TextEncoder().encode("nmsarchive"))).toBe(hex);
    expect(await sha256Hex(new TextEncoder().encode("other"))).not.toBe(hex);
  });
});
