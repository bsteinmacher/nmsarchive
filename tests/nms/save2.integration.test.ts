import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { detect } from "@/lib/nms/detect";
import { listFilledShips, listShips } from "@/lib/nms/extract/ships";
import { listMultitools } from "@/lib/nms/extract/multitools";
import { listCompanions } from "@/lib/nms/extract/companions";
import {
  extractExosuitLayout,
  exosuitHasSubstanceSlots,
  listExosuit,
} from "@/lib/nms/extract/exosuit";
import { listFreighters } from "@/lib/nms/extract/freighters";
import { listFrigates } from "@/lib/nms/extract/frigates";
import { listBases } from "@/lib/nms/extract/bases";
import { listWonders } from "@/lib/nms/extract/wonders";
import { reorderCategory } from "@/lib/nms/extract";
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

  it(
    "lista as categorias da Fase 3 no save2 (MT, pets, traje, frota, wonders)",
    async () => {
      const mapping = await loadMappingCached();
      const bytes = new Uint8Array(readFileSync(savePath));
      const parsed = parseHg(bytes, mapping);

      const tools = listMultitools(parsed.json);
      expect(tools).toHaveLength(6);
      expect(tools.filter((t) => !t.empty)).toHaveLength(4);
      expect(tools[4]?.empty).toBe(true);
      expect(tools.some((t) => t.itemType === "Atlas Staff")).toBe(true);

      const pets = listCompanions(parsed.json);
      expect(pets).toHaveLength(30);
      expect(pets.filter((p) => !p.empty)).toHaveLength(30);

      const suit = listExosuit(parsed.json);
      expect(suit).toHaveLength(1);
      expect(Number(suit[0]?.extra.tech)).toBeGreaterThan(0);
      expect(Number(suit[0]?.extra.supercharged)).toBe(3);
      const layout = extractExosuitLayout(parsed.json);
      expect(layout).toBeTruthy();
      expect(exosuitHasSubstanceSlots(layout)).toBe(false);

      const freighters = listFreighters(parsed.json);
      expect(freighters[0]?.empty).toBe(false);
      expect(freighters[0]?.itemType).toBe("Pirate");
      expect(freighters.filter((f) => f.empty)).toHaveLength(8);

      expect(listFrigates(parsed.json)).toHaveLength(17);
      expect(listBases(parsed.json)).toHaveLength(68);

      const wonders = listWonders(parsed.json);
      const personal = wonders.filter((w) => w.group !== "automatic");
      const auto = wonders.filter((w) => w.group === "automatic");
      expect(personal).toHaveLength(12);
      expect(personal.filter((w) => !w.empty)).toHaveLength(12);
      expect(auto.length).toBe(15 + 8 + 8 + 11 + 13 + 11);
      expect(auto.every((w) => w.readonly)).toBe(true);

      const reordered = reorderCategory(parsed.json, "multitool", 2, 4);
      expect(reordered.ok).toBe(true);
      if (!reordered.ok) return;
      const after = listMultitools(reordered.json);
      expect(after).toHaveLength(6);
      expect(after[4]?.empty).toBe(false);
      expect(after[2]?.empty).toBe(true);
      const player = getPlayerState(reordered.json)!;
      expect(player.ActiveMultioolIndex).toBe(4);
    },
    60_000,
  );
});

function asLength(value: unknown): number {
  return Array.isArray(value) ? value.length : -1;
}
