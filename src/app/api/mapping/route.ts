import { NextResponse } from "next/server";
import saveMessages from "../../../../messages/pt-BR/save.json";
import { loadMappingCached } from "@/lib/nms/mapping-node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mapping = await loadMappingCached();
    return NextResponse.json(mapping, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : saveMessages.mappingFetchFail;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
