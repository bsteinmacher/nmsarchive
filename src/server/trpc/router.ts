import { prisma } from "@/server/db";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(async () => {
    await prisma.$queryRaw`SELECT 1`;
    const [saves, items] = await Promise.all([
      prisma.save.count(),
      prisma.archivedItem.count(),
    ]);

    return {
      ok: true as const,
      service: "nmsarchive",
      phase: 1,
      database: "sqlite",
      saves,
      items,
    };
  }),
});

export type AppRouter = typeof appRouter;
