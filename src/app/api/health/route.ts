import { prisma } from "@/server/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, service: "nmsarchive" });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        service: "nmsarchive",
        error: error instanceof Error ? error.message : "database unavailable",
      },
      { status: 503 },
    );
  }
}
