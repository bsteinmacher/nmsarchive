import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export function createTestPrisma(): { prisma: PrismaClient; dbPath: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "nmsarchive-"));
  const dbPath = path.join(dir, "test.db");
  const url = `file:${dbPath}`;
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  return {
    prisma: new PrismaClient({ datasources: { db: { url } } }),
    dbPath,
  };
}
