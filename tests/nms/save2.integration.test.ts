import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { detect } from "@/lib/nms/detect";
import { listShips } from "@/lib/nms/extract/ships";
import {
  collectHighByteStrings,
  countHighBytes,
  parseJsonLatin1,
  stringifyJsonLatin1,
  stripTrailingNul,
} from "@/lib/nms/json";
import { decodeHg, decodeHgDetailed, encodeHg } from "@/lib/nms/lz4-blocks";
import { loadMappingCached } from "@/lib/nms/mapping-node";
import { parseHg, writeHg } from "@/lib/nms/parse";

const savePath = path.join(process.cwd(), ".others", "save2.hg");
const hasSave = existsSync(savePath);

describe.skipIf(!hasSave)("save2.hg (fixture local gitignored)", () => {
  it(
    "decodifica 13 blocos LZ4, mapeia naves e preserva bytes Latin-1 inválidos em UTF-8",
    async () => {
      const bytes = new Uint8Array(readFileSync(savePath));
      expect(detect(bytes)).toBe("lz4");

      const decoded = decodeHgDetailed(bytes);
      expect(decoded.blockCount).toBe(13);
      expect(decoded.bytes[0]).toBe(0x7b);
      expect(decoded.bytes[decoded.bytes.length - 1]).toBe(0);

      const stripped = stripTrailingNul(decoded.bytes);
      expect(countHighBytes(stripped)).toBeGreaterThan(0);
      expect(() =>
        new TextDecoder("utf-8", { fatal: true }).decode(stripped),
      ).toThrow();

      const mapping = await loadMappingCached();
      const parsed = parseHg(bytes, mapping);

      expect(parsed.summary.gameVersion).toBe(6783);
      expect(parsed.summary.platform).toBe("Win|Final");
      expect(parsed.summary.gameMode).toBe(5);
      expect(parsed.unknownKeys).toEqual([]);
      expect(parsed.ships.length).toBe(10);
      expect(parsed.summary.shipSlots).toBe(12);

      const highBefore = collectHighByteStrings(parseJsonLatin1(decoded.bytes));
      expect(highBefore.length).toBeGreaterThan(0);
      const highAfter = collectHighByteStrings(
        parseJsonLatin1(stringifyJsonLatin1(parseJsonLatin1(decoded.bytes))),
      );
      expect(highAfter).toEqual(highBefore);

      const rewritten = writeHg(parsed.json, mapping);
      const round = parseHg(rewritten, mapping);
      expect(round.summary.gameVersion).toBe(parsed.summary.gameVersion);
      expect(round.ships.map((s) => s.seed)).toEqual(
        parsed.ships.map((s) => s.seed),
      );
      expect(round.ships.map((s) => s.filename)).toEqual(
        parsed.ships.map((s) => s.filename),
      );

      const jsonAgain = decodeHg(encodeHg(stripped));
      expect(createHash("sha256").update(jsonAgain).digest("hex")).toBe(
        createHash("sha256").update(stripped).digest("hex"),
      );
      expect(listShips(parsed.json)).toHaveLength(10);
    },
    60_000,
  );
});
