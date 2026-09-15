import { saveScreenshot } from "@/server/screenshots";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "Envie a imagem em multipart." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Arquivo ausente." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const path = await saveScreenshot(bytes);
    return Response.json({ path });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao gravar a screenshot.";
    return Response.json({ error: message }, { status: 400 });
  }
}
