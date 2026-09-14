/** Formato de bloco LZ4 dos saves NMS (magic 0xFEEDA1E5). Spec pública, implementação própria. */

export const MAGIC = 0xfeeda1e5;
export const HEADER = 16;
export const MAX_CHUNK = 0x80000;

const MINMATCH = 4;
const LASTLITERALS = 5;
const MFLIMIT = 12;
const HASH_LOG = 16;
const HASH_SIZE = 1 << HASH_LOG;

export type HgBlockInfo = {
  compressedSize: number;
  uncompressedSize: number;
  payloadOffset: number;
};

export type DecodeHgResult = {
  bytes: Uint8Array;
  blockCount: number;
  blocks: HgBlockInfo[];
};

function viewOf(buf: Uint8Array): DataView {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
}

function isAllZero(buf: Uint8Array): boolean {
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 0) return false;
  }
  return true;
}

function writeExtraLength(dst: Uint8Array, d: number, extra: number): number {
  while (extra >= 255) {
    dst[d++] = 255;
    extra -= 255;
  }
  dst[d++] = extra;
  return d;
}

function readExtraLength(src: Uint8Array, s: number): { value: number; next: number } {
  let value = 0;
  while (true) {
    if (s >= src.length) {
      throw new Error("LZ4: fim inesperado na extra-length");
    }
    const n = src[s++];
    value += n;
    if (n !== 255) return { value, next: s };
  }
}

export function decompressBlock(src: Uint8Array, dst: Uint8Array): number {
  let s = 0;
  let d = 0;
  const slen = src.length;
  const dlen = dst.length;

  while (s < slen) {
    const token = src[s++];
    let litLen = token >>> 4;
    if (litLen === 15) {
      const extra = readExtraLength(src, s);
      litLen += extra.value;
      s = extra.next;
    }
    if (s + litLen > slen || d + litLen > dlen) {
      throw new Error("LZ4: overflow de literais");
    }
    if (litLen > 0) {
      dst.set(src.subarray(s, s + litLen), d);
      s += litLen;
      d += litLen;
    }

    if (s >= slen) break;

    if (s + 2 > slen) {
      throw new Error("LZ4: fim inesperado no offset");
    }
    const offset = src[s] | (src[s + 1] << 8);
    s += 2;
    if (offset === 0 || offset > d) {
      throw new Error(`LZ4: offset inválido (${offset})`);
    }

    let matchLen = (token & 15) + MINMATCH;
    if ((token & 15) === 15) {
      const extra = readExtraLength(src, s);
      matchLen += extra.value;
      s = extra.next;
    }
    if (d + matchLen > dlen) {
      throw new Error("LZ4: overflow de match");
    }
    const matchPos = d - offset;
    for (let i = 0; i < matchLen; i++) {
      dst[d++] = dst[matchPos + i];
    }
  }

  return d;
}

function emitSequence(
  src: Uint8Array,
  anchor: number,
  matchPos: number,
  offset: number,
  matchLen: number,
  dst: Uint8Array,
  d: number,
): number {
  const litLen = matchPos - anchor;
  const matchCode = matchLen - MINMATCH;
  const token =
    ((litLen >= 15 ? 15 : litLen) << 4) | (matchCode >= 15 ? 15 : matchCode);
  dst[d++] = token;
  if (litLen >= 15) d = writeExtraLength(dst, d, litLen - 15);
  if (litLen > 0) {
    dst.set(src.subarray(anchor, matchPos), d);
    d += litLen;
  }
  dst[d++] = offset & 0xff;
  dst[d++] = (offset >>> 8) & 0xff;
  if (matchCode >= 15) d = writeExtraLength(dst, d, matchCode - 15);
  return d;
}

function writeLastLiterals(
  src: Uint8Array,
  anchor: number,
  dst: Uint8Array,
  d: number,
): number {
  const litLen = src.length - anchor;
  const token = (litLen >= 15 ? 15 : litLen) << 4;
  dst[d++] = token;
  if (litLen >= 15) d = writeExtraLength(dst, d, litLen - 15);
  if (litLen > 0) {
    dst.set(src.subarray(anchor), d);
    d += litLen;
  }
  return d;
}

export function compressBound(size: number): number {
  return size + Math.floor(size / 255) + 16;
}

export function compressBlock(src: Uint8Array): Uint8Array {
  const dst = new Uint8Array(compressBound(src.length));
  const n = compressBlockInto(src, dst);
  return dst.slice(0, n);
}

function hash4(src: Uint8Array, i: number): number {
  const v = src[i] | (src[i + 1] << 8) | (src[i + 2] << 16) | (src[i + 3] << 24);
  return (Math.imul(v, 2654435761) >>> (32 - HASH_LOG)) & (HASH_SIZE - 1);
}

function compressBlockInto(src: Uint8Array, dst: Uint8Array): number {
  const len = src.length;
  if (len === 0) {
    dst[0] = 0;
    return 1;
  }
  if (len < MFLIMIT + 1) {
    return writeLastLiterals(src, 0, dst, 0);
  }

  const hashTable = new Int32Array(HASH_SIZE).fill(-1);
  let s = 1;
  let anchor = 0;
  let d = 0;
  const searchLimit = len - MFLIMIT;
  const matchLimit = len - LASTLITERALS;

  hashTable[hash4(src, 0)] = 0;

  while (s < searchLimit) {
    const h = hash4(src, s);
    const ref = hashTable[h];
    hashTable[h] = s;
    const offset = s - ref;
    if (
      ref < 0 ||
      offset <= 0 ||
      offset > 0xffff ||
      src[ref] !== src[s] ||
      src[ref + 1] !== src[s + 1] ||
      src[ref + 2] !== src[s + 2] ||
      src[ref + 3] !== src[s + 3]
    ) {
      s++;
      continue;
    }

    let matchLen = MINMATCH;
    const maxMatch = matchLimit - s;
    while (
      matchLen < maxMatch &&
      src[ref + matchLen] === src[s + matchLen]
    ) {
      matchLen++;
    }

    d = emitSequence(src, anchor, s, offset, matchLen, dst, d);
    s += matchLen;
    anchor = s;
  }

  return writeLastLiterals(src, anchor, dst, d);
}

export function readHgBlocks(buf: Uint8Array): HgBlockInfo[] {
  const view = viewOf(buf);
  const blocks: HgBlockInfo[] = [];
  let offset = 0;
  while (offset + HEADER <= buf.length) {
    const magic = view.getUint32(offset, true);
    if (magic !== MAGIC) {
      if (isAllZero(buf.subarray(offset))) break;
      throw new Error(`bloco LZ4 inválido no offset ${offset}`);
    }
    const compressedSize = view.getUint32(offset + 4, true);
    const uncompressedSize = view.getUint32(offset + 8, true);
    const reserved = view.getUint32(offset + 12, true);
    if (reserved !== 0) {
      throw new Error(`campo reservado ≠ 0 no offset ${offset}`);
    }
    if (uncompressedSize > MAX_CHUNK) {
      throw new Error(`uncompressedSize ${uncompressedSize} > ${MAX_CHUNK}`);
    }
    if (offset + HEADER + compressedSize > buf.length) {
      throw new Error("bloco LZ4 truncado");
    }
    blocks.push({
      compressedSize,
      uncompressedSize,
      payloadOffset: offset + HEADER,
    });
    offset += HEADER + compressedSize;
  }
  if (blocks.length === 0) {
    throw new Error("nenhum bloco LZ4 encontrado");
  }
  return blocks;
}

export function decodeHgDetailed(buf: Uint8Array): DecodeHgResult {
  const blocks = readHgBlocks(buf);
  let total = 0;
  for (const block of blocks) total += block.uncompressedSize;
  const out = new Uint8Array(total);
  let dst = 0;
  for (const block of blocks) {
    const payload = buf.subarray(
      block.payloadOffset,
      block.payloadOffset + block.compressedSize,
    );
    const written = decompressBlock(
      payload,
      out.subarray(dst, dst + block.uncompressedSize),
    );
    if (written !== block.uncompressedSize) {
      throw new Error(
        `LZ4: tamanho descomprimido ${written} ≠ ${block.uncompressedSize}`,
      );
    }
    dst += block.uncompressedSize;
  }
  return { bytes: out, blockCount: blocks.length, blocks };
}

export function decodeHg(buf: Uint8Array): Uint8Array {
  return decodeHgDetailed(buf).bytes;
}

export function encodeHg(jsonBytes: Uint8Array): Uint8Array {
  if (jsonBytes.length === 0) {
    throw new Error("JSON vazio");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < jsonBytes.length; i += MAX_CHUNK) {
    const slice = jsonBytes.subarray(i, Math.min(i + MAX_CHUNK, jsonBytes.length));
    const compressed = compressBlock(slice);
    const block = new Uint8Array(HEADER + compressed.length);
    const view = new DataView(block.buffer);
    view.setUint32(0, MAGIC, true);
    view.setUint32(4, compressed.length, true);
    view.setUint32(8, slice.length, true);
    view.setUint32(12, 0, true);
    block.set(compressed, HEADER);
    chunks.push(block);
    total += block.length;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const chunk of chunks) {
    out.set(chunk, o);
    o += chunk.length;
  }
  return out;
}
