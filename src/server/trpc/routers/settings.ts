import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { TRPCError } from "@trpc/server";
import { loadMappingCached, refreshMapping } from "@/lib/nms/mapping-node";
import {
  restoreBackupInputSchema,
  restoreUploadInputSchema,
} from "@/lib/validations";
import {
  backupDatabase,
  listBackupFiles,
  restoreFromBackupFile,
  restoreFromBytes,
} from "@/server/backup";
import { prisma } from "@/server/db";
import { logOperation } from "@/server/operations";
import {
  BACKUPS_DIR,
  databaseUrlDisplay,
  MAPPING_CACHE_PATH,
  resolveDatabasePath,
} from "@/server/paths";
import { withWritableSqlite } from "@/server/sqlite-errors";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";

const MAX_RESTORE_BYTES = 80 * 1024 * 1024;

export const settingsRouter = createTRPCRouter({
  get: publicProcedure.query(async () => {
    const dbPath = resolveDatabasePath();
    let mappingVersion: string | null = null;
    try {
      mappingVersion = (await loadMappingCached()).libMBIN_version;
    } catch {
      mappingVersion = null;
    }
    const dbExists = existsSync(dbPath);
    const dbStat = dbExists ? await stat(dbPath) : null;
    const backups = await listBackupFiles();
    return {
      databaseUrl: databaseUrlDisplay(),
      databasePath: dbPath,
      databaseExists: dbExists,
      databaseSize: dbStat?.size ?? null,
      mappingPath: MAPPING_CACHE_PATH,
      mappingVersion,
      backupsDir: BACKUPS_DIR,
      backups: backups.map((b) => ({
        fileName: b.fileName,
        size: b.size,
        mtime: new Date(b.mtimeMs).toISOString(),
      })),
    };
  }),

  backup: publicProcedure.mutation(async () =>
    withWritableSqlite(async () => {
      const result = await backupDatabase({ prisma });
      if (result.skipped) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Ainda não há banco para copiar.",
        });
      }
      await logOperation(prisma, {
        action: "backup",
        detail: { fileName: result.fileName, automatic: false },
      });
      return { fileName: result.fileName, pruned: result.pruned };
    }),
  ),

  restore: publicProcedure
    .input(restoreBackupInputSchema)
    .mutation(async ({ input }) => {
      const restored = await restoreFromBackupFile({
        fileName: input.fileName,
        prisma,
      });
      await logOperation(prisma, {
        action: "restore",
        detail: { restoredFrom: restored.restoredFrom },
      });
      return restored;
    }),

  restoreUpload: publicProcedure
    .input(restoreUploadInputSchema)
    .mutation(async ({ input }) => {
      if (input.bytes.byteLength > MAX_RESTORE_BYTES) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Arquivo .db maior do que o limite (80 MB).",
        });
      }
      const restored = await restoreFromBytes({
        bytes: input.bytes,
        prisma,
      });
      await logOperation(prisma, {
        action: "restore",
        detail: {
          bytes: restored.bytes,
          fileName: input.fileName ?? null,
          upload: true,
        },
      });
      return restored;
    }),

  updateMapping: publicProcedure.mutation(async () => {
    const mapping = await refreshMapping();
    await logOperation(prisma, {
      action: "mapping_update",
      detail: { libMBIN_version: mapping.libMBIN_version },
    });
    return { libMBIN_version: mapping.libMBIN_version };
  }),
});
