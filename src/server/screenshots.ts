import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  assertStoredWebp,
  screenshotFileName,
} from "@/lib/screenshots";
import { SCREENSHOTS_DIR } from "@/server/paths";

export function screenshotAbsolutePath(fileName: string): string {
  const base = screenshotFileName(fileName);
  const abs = path.resolve(SCREENSHOTS_DIR, base);
  const root = path.resolve(SCREENSHOTS_DIR);
  if (abs !== path.join(root, base)) {
    throw new Error("Screenshot inválido.");
  }
  return abs;
}

export async function saveScreenshot(bytes: Uint8Array): Promise<string> {
  assertStoredWebp(bytes);
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  const fileName = `${randomUUID()}.webp`;
  await writeFile(screenshotAbsolutePath(fileName), bytes);
  return fileName;
}

export async function readScreenshot(id: string): Promise<Uint8Array> {
  const abs = screenshotAbsolutePath(id);
  if (!existsSync(abs)) {
    throw new Error("Screenshot não encontrada.");
  }
  return new Uint8Array(await readFile(abs));
}

export async function deleteScreenshot(
  fileName: string | null | undefined,
): Promise<void> {
  if (!fileName) return;
  try {
    const abs = screenshotAbsolutePath(fileName);
    if (existsSync(abs)) await unlink(abs);
  } catch {
    // path inválido ou arquivo já sumiu — não bloqueia a mutation
  }
}
