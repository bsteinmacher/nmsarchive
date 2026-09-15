import { createSaveMetadata, serializeSave } from "@/server/archive-service";
import { prisma } from "@/server/db";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";
import { saveMetadataInputSchema } from "@/lib/validations";

export const savesRouter = createTRPCRouter({
  createMetadata: publicProcedure
    .input(saveMetadataInputSchema)
    .mutation(async ({ input }) => {
      const { save, created } = await createSaveMetadata(prisma, input);
      return { ...serializeSave(save), created };
    }),
});
