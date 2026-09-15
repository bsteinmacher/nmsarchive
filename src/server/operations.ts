import type { Prisma, PrismaClient } from "@prisma/client";

export const OPERATION_ACTIONS = [
  "export",
  "import",
  "archive",
  "update",
  "delete",
  "backup",
  "restore",
  "mapping_update",
  "currency_edit",
  "reorder",
  "save_create",
] as const;

export type OperationAction = (typeof OPERATION_ACTIONS)[number];

export type LogOperationInput = {
  action: OperationAction;
  category?: string | null;
  itemId?: string | null;
  saveId?: string | null;
  detail?: Prisma.InputJsonValue;
};

export async function logOperation(
  prisma: PrismaClient,
  input: LogOperationInput,
) {
  return prisma.operationLog.create({
    data: {
      action: input.action,
      category: input.category ?? null,
      itemId: input.itemId ?? null,
      saveId: input.saveId ?? null,
      detail: input.detail ?? undefined,
    },
  });
}
