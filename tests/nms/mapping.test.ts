import { describe, expect, it } from "vitest";
import {
  buildMappingIndex,
  compareLibMbinVersion,
  deobfuscate,
  isReadableSave,
  mappingUpdateAvailable,
  obfuscate,
  parseMappingFile,
} from "@/lib/nms/mapping";

const mini = parseMappingFile({
  libMBIN_version: "test",
  Mapping: [
    { Key: "F2P", Value: "Version" },
    { Key: "6f=", Value: "PlayerStateData" },
    { Key: "@b2", Value: "Name" },
  ],
});

describe("mapping walk", () => {
  it("deobfusca com Map O(1) e reobfusca de volta", () => {
    const index = buildMappingIndex(mini);
    const obfuscated = {
      F2P: 6783,
      "6f=": { "@b2": "Traveller", extra: 1 },
      list: [{ F2P: 1 }],
    };
    const unknown = new Set<string>();
    const readable = deobfuscate(obfuscated, index, unknown) as Record<
      string,
      unknown
    >;
    expect(readable).toEqual({
      Version: 6783,
      PlayerStateData: { Name: "Traveller", extra: 1 },
      list: [{ Version: 1 }],
    });
    expect(unknown.has("extra")).toBe(true);
    expect(isReadableSave(readable)).toBe(true);
    expect(obfuscate(readable, index)).toEqual(obfuscated);
  });

  it("mantém chave desconhecida e registra em unknownKeys", () => {
    const index = buildMappingIndex(mini);
    const unknown = new Set<string>();
    const out = deobfuscate({ "Zz?": 1, F2P: 2 }, index, unknown) as Record<
      string,
      unknown
    >;
    expect(out["Zz?"]).toBe(1);
    expect(out.Version).toBe(2);
    expect([...unknown]).toEqual(["Zz?"]);
  });

  it("não marca chaves já legíveis (Values do mapping) como unknown", () => {
    const index = buildMappingIndex(mini);
    const unknown = new Set<string>();
    deobfuscate({ Version: 1, Name: "x" }, index, unknown);
    expect([...unknown]).toEqual([]);
  });

  it("ordena libMBIN_version por segmentos numéricos", () => {
    expect(compareLibMbinVersion("7.1.0.1", "7.10.0.1")).toBeLessThan(0);
    expect(compareLibMbinVersion("7.10.0.2", "7.10.0.1")).toBeGreaterThan(0);
    expect(compareLibMbinVersion("7.10.0.1", "7.10.0.1")).toBe(0);
  });

  it("só marca atualização quando a versão remota existe e é mais nova", () => {
    expect(mappingUpdateAvailable("7.10.0.1", "7.1.0.1")).toBe(true);
    expect(mappingUpdateAvailable("7.10.0.1", "7.10.0.1")).toBe(false);
    expect(mappingUpdateAvailable("7.1.0.1", "7.10.0.1")).toBe(false);
    expect(mappingUpdateAvailable(null, "7.1.0.1")).toBe(false);
    expect(mappingUpdateAvailable("7.10.0.1", null)).toBe(false);
    expect(mappingUpdateAvailable("unknown", "7.1.0.1")).toBe(false);
  });

  it("rejeita mapping.json sem array Mapping", () => {
    expect(() => parseMappingFile({ libMBIN_version: "1" })).toThrow(
      /Mapping/,
    );
  });
});
