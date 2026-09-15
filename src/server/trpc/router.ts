import { prisma } from "@/server/db";
import { itemsRouter } from "@/server/trpc/routers/items";
import { logsRouter } from "@/server/trpc/routers/logs";
import { savesRouter } from "@/server/trpc/routers/saves";
import { settingsRouter } from "@/server/trpc/routers/settings";
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
      phase: 2,
      database: "sqlite",
      saves,
      items,
    };
  }),
  saves: savesRouter,
  items: itemsRouter,
  logs: logsRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
