import { TRPCError } from "@trpc/server";
import {
  archiveItemInputSchema,
  itemIdInputSchema,
  listItemsInputSchema,
  listTagsInputSchema,
  updateItemInputSchema,
} from "@/lib/validations";
import {
  archiveItem,
  countItemsByCategory,
  deleteItem,
  getItem,
  listFilterOptions,
  listItems,
  listTags,
  updateItem,
} from "@/server/archive-service";
import { backupDatabase } from "@/server/backup";
import { logOperation } from "@/server/operations";
import { prisma } from "@/server/db";
import { withWritableSqlite } from "@/server/sqlite-errors";
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
    .mutation(async ({ input }) =>
      withWritableSqlite(async () => {
        await backupBeforeMutation();
        return archiveItem(prisma, input);
      }),
    ),

  list: publicProcedure.input(listItemsInputSchema).query(async ({ input }) => {
    const items = await listItems(prisma, input);
    return { items, total: items.length };
  }),

  filterOptions: publicProcedure
    .input(listItemsInputSchema.pick({ category: true }))
    .query(async ({ input }) => listFilterOptions(prisma, input.category)),

  listTags: publicProcedure
    .input(listTagsInputSchema.optional())
    .query(async ({ input }) => listTags(prisma, input?.q)),

  counts: publicProcedure.query(async () => countItemsByCategory(prisma)),

  get: publicProcedure.input(itemIdInputSchema).query(async ({ input }) => {
    return getItem(prisma, input.id);
  }),

  update: publicProcedure
    .input(updateItemInputSchema)
    .mutation(async ({ input }) => {
      if (
        input.description == null &&
        !input.tags &&
        input.screenshotPath === undefined &&
        input.className === undefined &&
        !input.extra
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe descrição, tags, screenshot ou rank para atualizar.",
        });
      }
      return withWritableSqlite(() => updateItem(prisma, input));
    }),

  delete: publicProcedure
    .input(itemIdInputSchema)
    .mutation(async ({ input }) =>
      withWritableSqlite(async () => {
        await backupBeforeMutation();
        return deleteItem(prisma, input.id);
      }),
    ),
});
