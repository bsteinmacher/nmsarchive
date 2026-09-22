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
import {
  basePersistentType,
  listBases,
  listDeepSpaceBases,
  listFreighterBases,
  listSpaceStationBases,
} from "@/lib/nms/extract/bases";
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
import { asArray, asNumber, asRecord } from "@/lib/nms/value";
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

      expect(parsed.summary.gameVersion).toBe(6785);
      expect(parsed.summary.platform).toBe("Win|Final");
      expect(parsed.summary.gameMode).toBe(5);
      expect(parsed.unknownKeys).toEqual([]);
      expect(parsed.ships).toHaveLength(12);
      expect(parsed.ships.filter((s) => !s.empty)).toHaveLength(8);
      expect(parsed.summary.shipCount).toBe(8);
      expect(parsed.summary.shipSlots).toBe(12);
      expect(parsed.ships[9]?.empty).toBe(true);
      expect(parsed.ships[9]?.name).toBe("Slot 10 vazio");
      expect(parsed.ships[11]?.empty).toBe(true);
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
      expect(listFilledShips(parsed.json)).toHaveLength(8);
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
      const shipsBefore = listShips(parsed.json);
      const from = asNumber(before.PrimaryShip);
      expect(from).toBeTypeOf("number");
      if (from == null) return;
      const to = shipsBefore.findIndex(
        (ship, index) => ship.empty && index !== from,
      );
      expect(to).toBeGreaterThanOrEqual(0);
      const moved = shipsBefore[from];
      expect(moved?.empty).toBe(false);

      const result = reorderShipOwnership(parsed.json, from, to);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const ships = listShips(result.json);
      expect(ships).toHaveLength(12);
      expect(ships[to]?.seed).toBe(moved?.seed);
      expect(ships[to]?.empty).toBe(false);
      expect(ships[from]?.empty).toBe(true);
      expect(ships[from]?.name).toBe(`Slot ${from + 1} vazio`);
      expect(listFilledShips(result.json)).toHaveLength(8);

      const after = getPlayerState(result.json)!;
      expect(after.PrimaryShip).toBe(to);
      expect(asLength(after.ShipOwnership)).toBe(12);
      expect(asLength(after.ShipUsesLegacyColours)).toBe(12);
    },
    60_000,
  );

  it(
    "ao reordenar naves, PlayerShipBase.UserData segue o slot e FreighterBase não muda",
    async () => {
      const mapping = await loadMappingCached();
      const bytes = new Uint8Array(readFileSync(savePath));
      const parsed = parseHg(bytes, mapping);
      const before = getPlayerState(parsed.json)!;
      const basesBefore = asArray(before.PersistentPlayerBases) ?? [];
      const hull = basesBefore.find(
        (slot) => basePersistentType(slot) === "PlayerShipBase",
      );
      const freighter = basesBefore.find(
        (slot) => basePersistentType(slot) === "FreighterBase",
      );
      const from = asNumber(asRecord(hull)?.UserData);
      expect(from).toBeTypeOf("number");
      if (from == null) return;
      const shipsBefore = listShips(parsed.json);
      const to = shipsBefore.findIndex(
        (ship, index) => ship.empty && index !== from,
      );
      expect(to).toBeGreaterThanOrEqual(0);
      const freighterUserData = asRecord(freighter)?.UserData;

      const result = reorderShipOwnership(parsed.json, from, to);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const after = getPlayerState(result.json)!;
      const basesAfter = asArray(after.PersistentPlayerBases) ?? [];
      const hullAfter = basesAfter.find(
        (slot) =>
          basePersistentType(slot) === "PlayerShipBase" &&
          asRecord(slot)?.Name === asRecord(hull)?.Name &&
          asArray(asRecord(slot)?.Objects)?.length ===
            asArray(asRecord(hull)?.Objects)?.length,
      );
      const freighterAfter = basesAfter.find(
        (slot) => basePersistentType(slot) === "FreighterBase",
      );
      expect(asNumber(asRecord(hullAfter)?.UserData)).toBe(to);
      expect(asRecord(freighterAfter)?.UserData).toEqual(freighterUserData);
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
      expect(tools.filter((t) => !t.empty)).toHaveLength(6);
      expect(tools.some((t) => t.itemType === "Atlas Staff")).toBe(true);

      const pets = listCompanions(parsed.json);
      expect(pets).toHaveLength(30);
      expect(pets.filter((p) => !p.empty)).toHaveLength(30);
      expect(pets[0]).toMatchObject({
        extra: {
          biome: "Lush",
          element: "Mecânico",
          level: "0",
        },
      });
      expect(pets[0]?.extra.classes).toBeUndefined();
      expect(pets.some((p) => p.extra.biome === "Frozen" && p.extra.element === "Gelo")).toBe(
        true,
      );
      expect(pets.every((p) => p.seed.startsWith("0x"))).toBe(true);

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
      const bases = listBases(parsed.json);
      expect(bases).toHaveLength(68);
      expect(
        bases.every(
          (item) =>
            item.extra.baseType !== "PlayerSpaceBase" &&
            item.extra.baseType !== "PlayerSpaceStationBase",
        ),
      ).toBe(true);
      const interior = listFreighterBases(parsed.json);
      expect(interior).toHaveLength(1);
      expect(interior[0]?.slotLabel).toBe("Interior");
      expect(Number(interior[0]?.extra.objects)).toBeGreaterThan(50);

      const deep = listDeepSpaceBases(parsed.json);
      expect(deep).toHaveLength(2);
      expect(deep.map((item) => item.index)).toEqual([68, 70]);
      expect(deep.every((item) => item.category === "deepspace")).toBe(true);
      const stations = listSpaceStationBases(parsed.json);
      expect(stations).toHaveLength(1);
      expect(stations[0]?.index).toBe(69);
      expect(stations[0]?.category).toBe("spacestation");
      expect(Number(stations[0]?.extra.objects)).toBeGreaterThan(50);

      const wonders = listWonders(parsed.json);
      const personal = wonders.filter((w) => w.group !== "automatic");
      const auto = wonders.filter((w) => w.group === "automatic");
      expect(personal).toHaveLength(12);
      expect(personal.filter((w) => !w.empty)).toHaveLength(12);
      expect(auto.length).toBe(15 + 8 + 8 + 11 + 13 + 11);
      expect(auto.every((w) => w.readonly)).toBe(true);

      const beforePlayer = getPlayerState(parsed.json)!;
      const activeBefore = asNumber(beforePlayer.ActiveMultioolIndex);
      const reordered = reorderCategory(parsed.json, "multitool", 2, 4);
      expect(reordered.ok).toBe(true);
      if (!reordered.ok) return;
      const afterTools = listMultitools(reordered.json);
      expect(afterTools).toHaveLength(6);
      expect(afterTools[4]?.seed).toBe(tools[2]?.seed);
      expect(afterTools[2]?.seed).toBe(tools[4]?.seed);
      const player = getPlayerState(reordered.json)!;
      const expectedActive =
        activeBefore === 2 ? 4 : activeBefore === 4 ? 2 : activeBefore;
      expect(player.ActiveMultioolIndex).toBe(expectedActive);
    },
    60_000,
  );
});

function asLength(value: unknown): number {
  return Array.isArray(value) ? value.length : -1;
}
