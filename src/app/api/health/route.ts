import { prisma } from "@/server/db";
import { checkHealth } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkHealth(() => prisma.$queryRaw`SELECT 1`);
  return Response.json(result.body, { status: result.status });
}
