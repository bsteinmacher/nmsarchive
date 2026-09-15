import { prisma } from "@/server/db";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";
import { listLogsInputSchema } from "@/lib/validations";

export const logsRouter = createTRPCRouter({
  list: publicProcedure.input(listLogsInputSchema).query(async ({ input }) => {
    const rows = await prisma.operationLog.findMany({
      where: input.action ? { action: input.action } : undefined,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      include: {
        item: { select: { name: true, seed: true, category: true } },
        save: { select: { fileName: true, saveName: true } },
      },
    });
    return rows;
  }),
});
