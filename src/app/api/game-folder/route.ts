import os from "node:os";
import {
  GameFolderError,
  clearGameFolder,
  gameFolderStatus,
  isLocalRequest,
  selectGameFolder,
} from "@/server/game-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denied() {
  return Response.json({ error: "Só neste computador." }, { status: 403 });
}

function failure(err: unknown) {
  if (err instanceof GameFolderError) {
    return Response.json(
      { error: err.message, lastModified: err.lastModified },
      { status: err.status },
    );
  }
  const message = err instanceof Error ? err.message : "Não deu para ler a pasta.";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(req: Request) {
  if (!isLocalRequest(req)) return denied();
  try {
    return Response.json(await gameFolderStatus(os.homedir()));
  } catch (err) {
    return failure(err);
  }
}

export async function DELETE(req: Request) {
  if (!isLocalRequest(req)) return denied();
  try {
    return Response.json(await clearGameFolder(os.homedir()));
  } catch (err) {
    return failure(err);
  }
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) return denied();
  try {
    const body = (await req.json()) as { path?: unknown };
    if (typeof body.path !== "string" || !body.path.trim()) {
      return Response.json({ error: "Informe o caminho da pasta." }, { status: 400 });
    }
    return Response.json(await selectGameFolder(os.homedir(), body.path.trim()));
  } catch (err) {
    return failure(err);
  }
}
