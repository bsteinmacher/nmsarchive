import { SCREENSHOT_MAX_BYTES } from "@/lib/screenshots";
import archiveMessages from "../../messages/pt-BR/archive.json";
import commonMessages from "../../messages/pt-BR/common.json";

const SOURCE_MAX_BYTES = 8 * 1024 * 1024;

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(archiveMessages.webpFailed));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

/** Converte JPEG/PNG/WebP no browser para WebP ≤ 1 MB (o servidor só aceita WebP). */
export async function prepareScreenshot(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new Error(archiveMessages.chooseImage);
  }
  if (file.size > SOURCE_MAX_BYTES) {
    throw new Error(archiveMessages.imageTooBig);
  }
  if (file.type === "image/webp" && file.size <= SCREENSHOT_MAX_BYTES) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  let width = bitmap.width;
  let height = bitmap.height;
  let quality = 0.9;

  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error(archiveMessages.webpFailed);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToWebp(canvas, quality);
      if (blob.size <= SCREENSHOT_MAX_BYTES) return blob;
      quality = Math.max(0.5, quality - 0.1);
      width *= 0.8;
      height *= 0.8;
    }
  } finally {
    bitmap.close();
  }

  throw new Error(archiveMessages.under1mb);
}

export async function uploadScreenshot(file: File): Promise<string> {
  const blob = await prepareScreenshot(file);
  const body = new FormData();
  body.append("file", blob, "screenshot.webp");
  const res = await fetch("/api/screenshots", { method: "POST", body });
  const payload = (await res.json().catch(() => null)) as
    | { path?: string; error?: string }
    | null;
  if (!res.ok) {
    throw new Error(payload?.error ?? commonMessages.failScreenshot);
  }
  if (!payload?.path) {
    throw new Error(commonMessages.failScreenshot);
  }
  return payload.path;
}
