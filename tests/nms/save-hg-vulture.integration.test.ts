import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { insertShip, listShips } from "@/lib/nms/extract/ships";
import { loadMappingCached } from "@/lib/nms/mapping-node";
import { parseHg } from "@/lib/nms/parse";
import { getPlayerState } from "@/lib/nms/player";
import { shipCustomisationIndex } from "@/lib/nms/reorder";
import { asArray, asRecord } from "@/lib/nms/value";

const savePath = path.join(process.cwd(), ".others", "save.hg");
const hasSave = existsSync(savePath);
const VULTURE_SEED = "0x1170c1a4e21d17f8";

function groupsOf(entry: unknown): string[] {
  const data = asRecord(asRecord(entry)?.CustomData);
  return (asArray(data?.DescriptorGroups) ?? []).map(String);
}

function textureNamesOf(entry: unknown): string[] {
  const data = asRecord(asRecord(entry)?.CustomData);
  return (asArray(data?.TextureOptions) ?? []).map((opt) => {
    const rec = asRecord(opt);
    return String(rec?.TextureOptionName ?? "");
  });
}

describe.skipIf(!hasSave)("save.hg Iron Vulture (fixture local gitignored)", () => {
  it(
    "empacota DROPS_*13 + STEALTH e cola o bloco no CCD do slot destino",
    async () => {
      const mapping = await loadMappingCached();
      const parsed = parseHg(new Uint8Array(readFileSync(savePath)), mapping);
      const vulture = listShips(parsed.json).find(
        (ship) => ship.seed === VULTURE_SEED,
      );
      expect(vulture).toBeDefined();
      if (!vulture) return;

      const payload = vulture.payload as {
        kind?: string;
        ownership?: unknown;
        customisation?: unknown;
      };
      expect(payload.kind).toBe("ship");
      expect(asRecord(payload.ownership)?.kind).toBeUndefined();
      const groups = groupsOf(payload.customisation);
      expect(groups).toEqual(
        expect.arrayContaining([
          "^DROPS_COCKS13",
          "^DROPS_ENGIS13",
          "^DROPS_WINGS13",
        ]),
      );
      expect(textureNamesOf(payload.customisation)).toContain("^STEALTH");

      const result = insertShip(parsed.json, payload);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const dest = result.index;
      const ccdIndex = shipCustomisationIndex(dest);
      expect(ccdIndex).not.toBeNull();
      const ccd = asArray(getPlayerState(result.json)?.CharacterCustomisationData);
      const applied = ccd && ccdIndex != null ? ccd[ccdIndex] : undefined;
      expect(groupsOf(applied)).toEqual(
        expect.arrayContaining([
          "^DROPS_COCKS13",
          "^DROPS_ENGIS13",
          "^DROPS_WINGS13",
        ]),
      );
      expect(textureNamesOf(applied)).toContain("^STEALTH");

      const ownership = asArray(getPlayerState(result.json)?.ShipOwnership)?.[
        dest
      ];
      expect(asRecord(ownership)?.kind).toBeUndefined();
    },
    30_000,
  );
});
