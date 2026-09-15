import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { detect } from "@/lib/nms/detect";
import { listFilledShips, listShips } from "@/lib/nms/extract/ships";
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
import { getPlayerState } from "@/lib/nms/player";
import { reorderShipOwnership } from "@/lib/nms/write";

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
      expect(parsed.ships).toHaveLength(12);
      expect(parsed.ships.filter((s) => !s.empty)).toHaveLength(10);
      expect(parsed.summary.shipCount).toBe(10);
      expect(parsed.summary.shipSlots).toBe(12);
      expect(parsed.ships[9]?.empty).toBe(true);
      expect(parsed.ships[9]?.name).toBe("Slot 10 vazio");
      expect(parsed.ships[11]?.empty).toBe(true);
      expect(parsed.ships[10]?.shipType).toBe("Fighter");
      expect(parsed.summary.galaxy).toBe(255);
      expect(parsed.summary.galaxyLabel).toBe("256 · Odyalutai");

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
      expect(listShips(parsed.json)).toHaveLength(12);
      expect(listFilledShips(parsed.json)).toHaveLength(10);
    },
    60_000,
  );

  it(
    "reordena ShipOwnership no save2 sem compactar e atualiza PrimaryShip",
    async () => {
      const mapping = await loadMappingCached();
      const bytes = new Uint8Array(readFileSync(savePath));
      const parsed = parseHg(bytes, mapping);
      const before = getPlayerState(parsed.json)!;
      expect(before.PrimaryShip).toBe(10);
      expect(listShips(parsed.json)[10]?.name).toBe("Horizon Vector NX");

      const result = reorderShipOwnership(parsed.json, 10, 9);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const ships = listShips(result.json);
      expect(ships).toHaveLength(12);
      expect(ships[9]?.name).toBe("Horizon Vector NX");
      expect(ships[9]?.empty).toBe(false);
      expect(ships[10]?.empty).toBe(true);
      expect(ships[10]?.name).toBe("Slot 11 vazio");
      expect(listFilledShips(result.json)).toHaveLength(10);

      const after = getPlayerState(result.json)!;
      expect(after.PrimaryShip).toBe(9);
      expect(asLength(after.ShipOwnership)).toBe(12);
      expect(asLength(after.ShipUsesLegacyColours)).toBe(12);
    },
    60_000,
  );
});

function asLength(value: unknown): number {
  return Array.isArray(value) ? value.length : -1;
}
