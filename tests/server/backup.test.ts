import { existsSync, mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertBackupFileName,
  backupDatabase,
  backupFileName,
  listBackupFiles,
  pruneBackups,
} from "@/server/backup";
import { resolveDatabasePath } from "@/server/paths";

describe("backup sqlite", () => {
  it("nomeia o arquivo com YYYYMMDD-HHmmss", () => {
    const name = backupFileName(new Date(2026, 8, 14, 21, 45, 3));
    expect(name).toBe("nmsarchive-20260914-214503.db");
  });

  it("rejeita path traversal no nome do backup", () => {
    expect(() => assertBackupFileName("../secret.db")).toThrow(/inválido/);
    expect(() => assertBackupFileName("nmsarchive-20260914-214503.db")).not.toThrow();
  });

  it("copia o .db, guarda 20 e apaga o resto", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "nms-bak-"));
    const dbPath = path.join(dir, "nmsarchive.db");
    const backupsDir = path.join(dir, "backups");
    await writeFile(dbPath, "sqlite-fake");
    await mkdir(backupsDir, { recursive: true });

    for (let i = 0; i < 22; i++) {
      const now = new Date(2026, 0, 1, 0, 0, i);
      await backupDatabase({ dbPath, backupsDir, keep: 20, now });
    }
    const listed = await listBackupFiles(backupsDir);
    expect(listed).toHaveLength(20);
    expect(listed[0]?.fileName).toBe("nmsarchive-20260101-000021.db");
    expect(existsSync(path.join(backupsDir, "nmsarchive-20260101-000000.db"))).toBe(
      false,
    );
  });

  it("pruneBackups não apaga se está dentro do limite", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "nms-bak-"));
    const pruned = await pruneBackups(dir, 20);
    expect(pruned).toEqual([]);
  });

  it("resolve DATABASE_URL file: relativo ao prisma/", () => {
    const resolved = resolveDatabasePath("file:../data/nmsarchive.db");
    expect(resolved).toBe(path.resolve(process.cwd(), "data", "nmsarchive.db"));
  });
});
