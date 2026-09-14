export function stripTrailingNul(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
    return bytes.subarray(0, bytes.length - 1);
  }
  return bytes;
}

/**
 * 1 byte = 1 char (U+0000–U+00FF). Não usar TextDecoder("latin1"):
 * o label WHATWG aponta para windows-1252 (0x80 vira €).
 */
export function bytesToLatin1(bytes: Uint8Array): string {
  const CHUNK = 0x2000;
  let out = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    out += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return out;
}

export function latin1ToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c > 255) {
      throw new Error(`octet > 255 no índice ${i} — o JSON não é Latin-1`);
    }
    out[i] = c;
  }
  return out;
}

/** Escapa BMP > 255 para \\uXXXX, preservando U+0080–U+00FF do round-trip Latin-1. */
export function stringifyLatin1Safe(value: unknown): string {
  return JSON.stringify(value).replace(/[\u0100-\uffff]/g, (ch) => {
    return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
  });
}

export function parseJsonLatin1(bytes: Uint8Array): unknown {
  return JSON.parse(bytesToLatin1(stripTrailingNul(bytes)));
}

export function stringifyJsonLatin1(value: unknown): Uint8Array {
  return latin1ToBytes(stringifyLatin1Safe(value));
}

export function bytesToUtf8Lossy(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(
    stripTrailingNul(bytes),
  );
}

export function countHighBytes(bytes: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] >= 0x80) n++;
  }
  return n;
}

export function collectHighByteStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) >= 0x80) {
        acc.push(value);
        break;
      }
    }
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHighByteStrings(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectHighByteStrings(nested, acc);
    }
  }
  return acc;
}
