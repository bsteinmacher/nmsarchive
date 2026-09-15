import path from "node:path";
import { MAPPING_CACHE_PATH } from "@/lib/nms/mapping-node";

export { MAPPING_CACHE_PATH };

export const DATA_DIR = path.join(process.cwd(), "data");
export const BACKUPS_DIR = path.join(DATA_DIR, "backups");

/** Resolve DATABASE_URL `file:` relativo ao diretório do schema Prisma. */
export function resolveDatabasePath(
  databaseUrl = process.env.DATABASE_URL ?? "file:../data/nmsarchive.db",
): string {
  const stripped = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(stripped)) return stripped;
  return path.resolve(process.cwd(), "prisma", stripped);
}

export function databaseUrlDisplay(
  databaseUrl = process.env.DATABASE_URL ?? "file:../data/nmsarchive.db",
): string {
  return databaseUrl;
}
