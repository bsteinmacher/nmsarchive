import os from "node:os";
import { GameFolderError, isLocalRequest, pickDirectoryDialog } from "@/server/game-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isLocalRequest(req)) {
    return Response.json({ error: "Só neste computador." }, { status: 403 });
  }
  try {
    const picked = await pickDirectoryDialog(os.homedir());
    if (!picked) return Response.json({ cancelled: true });
    return Response.json({ path: picked });
  } catch (err) {
    if (err instanceof GameFolderError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Não consegui abrir o seletor de pasta.";
    return Response.json({ error: message }, { status: 500 });
  }
}
