import { NextResponse } from "next/server";
import { loadMappingCached } from "@/lib/nms/mapping-node";

export const runtime = "nodejs";

export async function GET() {
  try {
    const mapping = await loadMappingCached();
    return NextResponse.json(mapping);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao obter mapping.json";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
