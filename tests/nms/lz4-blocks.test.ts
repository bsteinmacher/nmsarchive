import { describe, expect, it } from "vitest";
import { detect } from "@/lib/nms/detect";
import {
  MAGIC,
  MAX_CHUNK,
  compressBlock,
  decodeHg,
  decodeHgDetailed,
  decompressBlock,
  encodeHg,
  readHgBlocks,
} from "@/lib/nms/lz4-blocks";
import { latin1ToBytes } from "@/lib/nms/json";

function u32le(value: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, value, true);
  return b;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

describe("detect", () => {
  it("reconhece JSON plaintext pelo '{'", () => {
    expect(detect(latin1ToBytes('{"Version":1}'))).toBe("json");
  });

  it("reconhece magic LZ4 little-endian", () => {
    expect(detect(u32le(MAGIC))).toBe("lz4");
  });

  it("rejeita lixo", () => {
    expect(detect(new Uint8Array([0, 1, 2, 3]))).toBe("unknown");
    expect(detect(new Uint8Array())).toBe("unknown");
  });
});

describe("lz4-blocks sintético", () => {
  it("decodifica um bloco LZ4 só de literais comprimido à mão", () => {
    const json = latin1ToBytes('{"a":1}');
    // token 0x70 = 7 literais, 0 match; payload = token + 7 bytes
    const payload = concat(new Uint8Array([0x70]), json);
    const hg = concat(
      u32le(MAGIC),
      u32le(payload.length),
      u32le(json.length),
      u32le(0),
      payload,
    );
    expect(decodeHg(hg)).toEqual(json);
    expect(readHgBlocks(hg)).toHaveLength(1);
  });

  it("decodifica match sobreposto (RLE de 'A')", () => {
    const src = latin1ToBytes("AAAAAA");
    // 1 literal + match offset 1 length 5
    const payload = new Uint8Array([0x11, 0x41, 0x01, 0x00]);
    const dst = new Uint8Array(6);
    expect(decompressBlock(payload, dst)).toBe(6);
    expect(dst).toEqual(src);
  });

  it("round-trip encodeHg/decodeHg preserva os bytes do JSON", () => {
    const json = latin1ToBytes(
      '{"Version":1,"hello":"world","repeat":"' + "xy".repeat(400) + '"}',
    );
    const hg = encodeHg(json);
    expect(detect(hg)).toBe("lz4");
    expect(decodeHg(hg)).toEqual(json);
  });

  it("fatiar acima de 512 KiB gera múltiplos blocos", () => {
    const json = latin1ToBytes('{"x":"' + "a".repeat(MAX_CHUNK + 50) + '"}');
    const hg = encodeHg(json);
    const info = decodeHgDetailed(hg);
    expect(info.blockCount).toBe(2);
    expect(info.bytes).toEqual(json);
    expect(info.blocks[0]?.uncompressedSize).toBe(MAX_CHUNK);
    expect(info.blocks.every((b) => b.uncompressedSize <= MAX_CHUNK)).toBe(
      true,
    );
  });

  it("compressBlock/decompressBlock em texto repetido", () => {
    const src = latin1ToBytes("abc".repeat(2000));
    const compressed = compressBlock(src);
    expect(compressed.length).toBeLessThan(src.length);
    const dst = new Uint8Array(src.length);
    expect(decompressBlock(compressed, dst)).toBe(src.length);
    expect(dst).toEqual(src);
  });
});
