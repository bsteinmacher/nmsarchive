import { TRPCError } from "@trpc/server";
import {
  archiveItemInputSchema,
  createTagInputSchema,
  itemIdInputSchema,
  listItemsInputSchema,
  listTagsInputSchema,
  updateItemInputSchema,
  updateTagInputSchema,
} from "@/lib/validations";
import {
  archiveItem,
  countItemsByCategory,
  createTag,
  deleteItem,
  deleteTag,
  getItem,
  listAllTags,
  listFilterOptions,
  listItems,
  listTags,
  updateItem,
  updateTag,
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

  listAllTags: publicProcedure.query(async () => listAllTags(prisma)),

  createTag: publicProcedure
    .input(createTagInputSchema)
    .mutation(async ({ input }) =>
      withWritableSqlite(async () => {
        await backupBeforeMutation();
        return createTag(prisma, input.label);
      }),
    ),

  updateTag: publicProcedure
    .input(updateTagInputSchema)
    .mutation(async ({ input }) =>
      withWritableSqlite(() => updateTag(prisma, input)),
    ),

  deleteTag: publicProcedure
    .input(itemIdInputSchema)
    .mutation(async ({ input }) =>
      withWritableSqlite(async () => {
        await backupBeforeMutation();
        return deleteTag(prisma, input.id);
      }),
    ),

  counts: publicProcedure.query(async () => countItemsByCategory(prisma)),

  get: publicProcedure.input(itemIdInputSchema).query(async ({ input }) => {
    return getItem(prisma, input.id);
  }),

  update: publicProcedure
    .input(updateItemInputSchema)
    .mutation(async ({ input }) => {
      if (
        input.description == null &&
        input.notes == null &&
        !input.tags &&
        input.screenshotPath === undefined &&
        input.className === undefined &&
        input.shipType === undefined &&
        !input.extra
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe título, descrição, tags, screenshot ou rank para atualizar.",
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
