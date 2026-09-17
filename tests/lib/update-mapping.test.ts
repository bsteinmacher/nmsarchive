import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { downloadMappingJson } from "../../scripts/update-mapping";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true })));
});

describe("downloadMappingJson", () => {
  it("grava o mapping baixado depois de validar o schema", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "nmsarchive-mapping-"));
    dirs.push(dir);
    const dest = path.join(dir, "mapping.json");
    const payload = {
      libMBIN_version: "7.1.0.1",
      Mapping: [{ Key: "F2P", Value: "Version" }],
    };
    const result = await downloadMappingJson(dest, async () =>
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    expect(result).toEqual({
      version: "7.1.0.1",
      dest,
      entries: 1,
    });
    expect(JSON.parse(await readFile(dest, "utf8"))).toEqual(payload);
  });

  it("rejeita HTTP de erro e JSON sem Mapping", async () => {
    await expect(
      downloadMappingJson("/tmp/unused.json", async () => new Response("", { status: 502 })),
    ).rejects.toThrow(/502/);
    await expect(
      downloadMappingJson(
        "/tmp/unused.json",
        async () => new Response(JSON.stringify({ libMBIN_version: "x" }), { status: 200 }),
      ),
    ).rejects.toThrow(/Mapping/);
  });
});
