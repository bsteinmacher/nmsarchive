import { SCREENSHOT_FILE_RE } from "@/lib/validations";

export const SCREENSHOT_MAX_BYTES = 1_048_576;

const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP_MARK = [0x57, 0x45, 0x42, 0x50];
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const SVG_OPEN = "<svg";

export type ScreenshotKind = "webp" | "jpeg" | "png" | "svg" | "unknown";

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.byteLength < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

function latin1Prefix(bytes: Uint8Array, length: number): string {
  const end = Math.min(bytes.byteLength, length);
  let out = "";
  for (let i = 0; i < end; i++) out += String.fromCharCode(bytes[i] ?? 0);
  return out;
}

export function detectScreenshotKind(bytes: Uint8Array): ScreenshotKind {
  const head = latin1Prefix(bytes, 256).trimStart().toLowerCase();
  if (head.startsWith(SVG_OPEN) || head.startsWith("<?xml")) return "svg";
  if (
    bytes.byteLength >= 12 &&
    startsWith(bytes, WEBP_RIFF) &&
    bytes[8] === WEBP_MARK[0] &&
    bytes[9] === WEBP_MARK[1] &&
    bytes[10] === WEBP_MARK[2] &&
    bytes[11] === WEBP_MARK[3]
  ) {
    return "webp";
  }
  if (startsWith(bytes, JPEG)) return "jpeg";
  if (startsWith(bytes, PNG)) return "png";
  return "unknown";
}

export function assertStoredWebp(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) {
    throw new Error("Imagem vazia.");
  }
  if (bytes.byteLength > SCREENSHOT_MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 1 MB.");
  }
  const kind = detectScreenshotKind(bytes);
  if (kind === "svg") {
    throw new Error("SVG não é aceito. Envie uma foto em WebP.");
  }
  if (kind !== "webp") {
    throw new Error("Envie a screenshot em WebP (máx. 1 MB).");
  }
}

export function screenshotFileName(id: string): string {
  const trimmed = id.trim();
  const withExt = trimmed.toLowerCase().endsWith(".webp")
    ? trimmed
    : `${trimmed}.webp`;
  const base = withExt.split(/[/\\]/).pop() ?? "";
  if (!SCREENSHOT_FILE_RE.test(base)) {
    throw new Error("Screenshot inválido.");
  }
  return base.toLowerCase();
}

export function screenshotPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  try {
    const fileName = screenshotFileName(path);
    const id = fileName.replace(/\.webp$/i, "");
    return `/api/screenshots/${id}`;
  } catch {
    return null;
  }
}
