import { describe, expect, it } from "vitest";
import {
  DATA_DIR_UNWRITABLE_MESSAGE,
  isSqliteReadonlyError,
  rethrowIfSqliteReadonly,
} from "@/server/sqlite-errors";
import { TRPCError } from "@trpc/server";

describe("sqlite readonly", () => {
  it("reconhece o erro 1544 / readonly database do Prisma", () => {
    const err = new Error(
      'Invalid `prisma.save.update()` invocation: ConnectorError { kind: QueryError(SqliteError { extended_code: 1544, message: Some("attempt to write a readonly database") }) }',
    );
    expect(isSqliteReadonlyError(err)).toBe(true);
    expect(isSqliteReadonlyError(new Error("unique constraint"))).toBe(false);
  });

  it("troca a mensagem por um aviso sobre data/", () => {
    try {
      rethrowIfSqliteReadonly(new Error("attempt to write a readonly database"));
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).message).toBe(DATA_DIR_UNWRITABLE_MESSAGE);
      return;
    }
    throw new Error("expected throw");
  });
});
