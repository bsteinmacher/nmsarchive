import { TRPCError } from "@trpc/server";
import {
  archiveItemInputSchema,
  itemIdInputSchema,
  listItemsInputSchema,
  updateItemInputSchema,
} from "@/lib/validations";
import {
  archiveItem,
  countItemsByCategory,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from "@/server/archive-service";
import { backupDatabase } from "@/server/backup";
import { logOperation } from "@/server/operations";
import { prisma } from "@/server/db";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";

async function backupBeforeMutation() {
  const result = await backupDatabase({ prisma });
  if (!result.skipped) {
    await logOperation(prisma, {
      action: "backup",
      detail: { fileName: result.fileName, automatic: true },
    });
  }
  return result;
}

export const itemsRouter = createTRPCRouter({
  archive: publicProcedure
    .input(archiveItemInputSchema)
    .mutation(async ({ input }) => {
      await backupBeforeMutation();
      return archiveItem(prisma, input);
    }),

  list: publicProcedure.input(listItemsInputSchema).query(async ({ input }) => {
    const items = await listItems(prisma, input.category);
    return { items, total: items.length };
  }),

  counts: publicProcedure.query(async () => countItemsByCategory(prisma)),

  get: publicProcedure.input(itemIdInputSchema).query(async ({ input }) => {
    return getItem(prisma, input.id);
  }),

  update: publicProcedure
    .input(updateItemInputSchema)
    .mutation(async ({ input }) => {
      if (input.description == null && !input.tags) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe descrição ou tags para atualizar.",
        });
      }
      return updateItem(prisma, input);
    }),

  delete: publicProcedure
    .input(itemIdInputSchema)
    .mutation(async ({ input }) => {
      await backupBeforeMutation();
      return deleteItem(prisma, input.id);
    }),
});
