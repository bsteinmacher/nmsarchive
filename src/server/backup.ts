import {
  copyFile,
  mkdir,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { BACKUP_KEEP_DEFAULT, BACKUP_NAME_RE } from "@/lib/validations";
import { BACKUPS_DIR, resolveDatabasePath } from "@/server/paths";

export type BackupInfo = {
  fileName: string;
  filePath: string;
  size: number;
  mtimeMs: number;
};

export function backupStamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

export function backupFileName(date = new Date()): string {
  return `nmsarchive-${backupStamp(date)}.db`;
}

export async function checkpointSqlite(prisma: PrismaClient): Promise<void> {
  await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
}

function sidecarPaths(dbPath: string): string[] {
  return [`${dbPath}-wal`, `${dbPath}-shm`];
}

export async function removeSqliteSidecars(dbPath: string): Promise<void> {
  for (const extra of sidecarPaths(dbPath)) {
    if (existsSync(extra)) await unlink(extra);
  }
}

export async function copySqliteFile(
  source: string,
  dest: string,
): Promise<void> {
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(source, dest);
}

export async function listBackupFiles(
  backupsDir = BACKUPS_DIR,
): Promise<BackupInfo[]> {
  if (!existsSync(backupsDir)) return [];
  const names = await readdir(backupsDir);
  const infos: BackupInfo[] = [];
  for (const fileName of names) {
    if (!BACKUP_NAME_RE.test(fileName)) continue;
    const filePath = path.join(backupsDir, fileName);
    const info = await stat(filePath);
    if (!info.isFile()) continue;
    infos.push({
      fileName,
      filePath,
      size: info.size,
      mtimeMs: info.mtimeMs,
    });
  }
  infos.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return infos;
}

export async function pruneBackups(
  backupsDir = BACKUPS_DIR,
  keep = BACKUP_KEEP_DEFAULT,
): Promise<string[]> {
  const infos = await listBackupFiles(backupsDir);
  const pruned: string[] = [];
  for (const extra of infos.slice(Math.max(keep, 0))) {
    await unlink(extra.filePath);
    pruned.push(extra.fileName);
  }
  return pruned;
}

export type BackupResult = {
  skipped: boolean;
  fileName?: string;
  filePath?: string;
  pruned: string[];
};

export async function backupDatabase(opts?: {
  dbPath?: string;
  backupsDir?: string;
  keep?: number;
  now?: Date;
  prisma?: PrismaClient;
}): Promise<BackupResult> {
  const dbPath = opts?.dbPath ?? resolveDatabasePath();
  const backupsDir = opts?.backupsDir ?? BACKUPS_DIR;
  const keep = opts?.keep ?? BACKUP_KEEP_DEFAULT;
  if (!existsSync(dbPath)) {
    return { skipped: true, pruned: [] };
  }
  if (opts?.prisma) {
    await checkpointSqlite(opts.prisma);
  }
  const fileName = backupFileName(opts?.now);
  const filePath = path.join(backupsDir, fileName);
  await copySqliteFile(dbPath, filePath);
  const pruned = await pruneBackups(backupsDir, keep);
  return { skipped: false, fileName, filePath, pruned };
}

export function assertBackupFileName(fileName: string): string {
  const base = path.basename(fileName);
  if (base !== fileName || !BACKUP_NAME_RE.test(base)) {
    throw new Error("Nome de backup inválido.");
  }
  return base;
}

export async function restoreFromBackupFile(opts: {
  fileName: string;
  dbPath?: string;
  backupsDir?: string;
  prisma?: PrismaClient;
}): Promise<{ restoredFrom: string }> {
  const dbPath = opts.dbPath ?? resolveDatabasePath();
  const backupsDir = opts.backupsDir ?? BACKUPS_DIR;
  const fileName = assertBackupFileName(opts.fileName);
  const source = path.join(backupsDir, fileName);
  if (!existsSync(source)) {
    throw new Error("Backup não encontrado.");
  }
  await backupDatabase({
    dbPath,
    backupsDir,
    prisma: opts.prisma,
  });
  if (opts.prisma) await opts.prisma.$disconnect();
  await copySqliteFile(source, dbPath);
  await removeSqliteSidecars(dbPath);
  return { restoredFrom: fileName };
}

export async function restoreFromBytes(opts: {
  bytes: Uint8Array;
  dbPath?: string;
  backupsDir?: string;
  prisma?: PrismaClient;
}): Promise<{ bytes: number }> {
  const dbPath = opts.dbPath ?? resolveDatabasePath();
  const backupsDir = opts.backupsDir ?? BACKUPS_DIR;
  if (opts.bytes.byteLength < 16) {
    throw new Error("Arquivo .db pequeno demais para ser um SQLite.");
  }
  const header = new TextDecoder("ascii").decode(opts.bytes.slice(0, 16));
  if (!header.startsWith("SQLite format 3")) {
    throw new Error("O arquivo não parece um banco SQLite.");
  }
  await backupDatabase({
    dbPath,
    backupsDir,
    prisma: opts.prisma,
  });
  if (opts.prisma) await opts.prisma.$disconnect();
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(dbPath, opts.bytes);
  await removeSqliteSidecars(dbPath);
  return { bytes: opts.bytes.byteLength };
}
