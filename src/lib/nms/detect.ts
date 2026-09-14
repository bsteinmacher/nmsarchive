import { MAGIC } from "./lz4-blocks";

export type SaveFormat = "json" | "lz4" | "unknown";

function readMagic(buf: Uint8Array): number | null {
  if (buf.length < 4) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getUint32(0, true);
}

export function detect(buf: Uint8Array): SaveFormat {
  if (buf.length >= 1 && buf[0] === 0x7b) return "json";
  const magic = readMagic(buf);
  if (magic === MAGIC) return "lz4";
  return "unknown";
}
