import { TRPCError } from "@trpc/server";

export const DATA_DIR_UNWRITABLE_MESSAGE =
  'A pasta data/ não é gravável — o SQLite precisa criar journal/WAL. Se o Docker rodou como outro usuário, no host: chown -R "$(id -u):$(id -g)" data';

export function isSqliteReadonlyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /readonly database/i.test(msg) ||
    /SQLITE_READONLY/i.test(msg) ||
    /extended_code: 1544/.test(msg)
  );
}

export function rethrowIfSqliteReadonly(err: unknown): never {
  if (isSqliteReadonlyError(err)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: DATA_DIR_UNWRITABLE_MESSAGE,
    });
  }
  throw err;
}

export async function withWritableSqlite<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    rethrowIfSqliteReadonly(err);
  }
}
