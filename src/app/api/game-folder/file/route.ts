import os from "node:os";
import {
  GameFolderError,
  isLocalRequest,
  readSaveFile,
  writeSelectedSave,
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
  const message = err instanceof Error ? err.message : "Não deu para gravar o save.";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(req: Request) {
  if (!isLocalRequest(req)) return denied();
  const name = new URL(req.url).searchParams.get("name") ?? "";
  try {
    const file = await readSaveFile(os.homedir(), name);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
        "x-last-modified": String(file.lastModified),
      },
    });
  } catch (err) {
    return failure(err);
  }
}

export async function POST(req: Request) {
  if (!isLocalRequest(req)) return denied();
  const name = req.headers.get("x-save-name") ?? "";
  const expectedRaw = req.headers.get("x-last-modified");
  const expected =
    expectedRaw == null || expectedRaw === "" ? null : Number(expectedRaw);
  if (expected != null && !Number.isFinite(expected)) {
    return Response.json({ error: "Data do arquivo inválida." }, { status: 400 });
  }
  try {
    const bytes = new Uint8Array(await req.arrayBuffer());
    const written = await writeSelectedSave(os.homedir(), name, bytes, expected);
    return Response.json(written);
  } catch (err) {
    return failure(err);
  }
}
