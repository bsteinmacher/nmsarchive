import { detect } from "./detect";
import { listShips } from "./extract/ships";
import {
  parseJsonLatin1,
  stringifyJsonLatin1,
  stripTrailingNul,
} from "./json";
import { decodeHgDetailed, encodeHg } from "./lz4-blocks";
import {
  buildMappingIndex,
  deobfuscate,
  isReadableSave,
  obfuscate,
  type MappingFile,
} from "./mapping";
import { summarizePlayer, type PlayerSummary } from "./player";
import type { ExtractedShip } from "./extract/types";

export type ParseResult = {
  format: "json" | "lz4";
  json: unknown;
  unknownKeys: string[];
  mappingVersion: string;
  blockCount: number;
  jsonByteLength: number;
  summary: PlayerSummary;
  ships: ExtractedShip[];
};

export function parseHg(bytes: Uint8Array, mapping: MappingFile): ParseResult {
  const kind = detect(bytes);
  if (kind === "unknown") {
    throw new Error("Arquivo não é um save .hg reconhecido (JSON ou LZ4)");
  }

  let jsonBytes: Uint8Array;
  let blockCount = 0;
  if (kind === "lz4") {
    const decoded = decodeHgDetailed(bytes);
    jsonBytes = decoded.bytes;
    blockCount = decoded.blockCount;
  } else {
    jsonBytes = bytes;
  }

  const raw = parseJsonLatin1(jsonBytes);
  const index = buildMappingIndex(mapping);
  const unknownKeys = new Set<string>();
  const json = deobfuscate(raw, index, unknownKeys);
  if (!isReadableSave(json)) {
    throw new Error(
      "O save ainda está ofuscado. Atualize o mapping.json (MBINCompiler).",
    );
  }

  return {
    format: kind,
    json,
    unknownKeys: [...unknownKeys].sort(),
    mappingVersion: mapping.libMBIN_version,
    blockCount,
    jsonByteLength: stripTrailingNul(jsonBytes).length,
    summary: summarizePlayer(json),
    ships: listShips(json),
  };
}

export function writeHg(mappedJson: unknown, mapping: MappingFile): Uint8Array {
  const index = buildMappingIndex(mapping);
  const obfuscated = obfuscate(mappedJson, index);
  return encodeHg(stringifyJsonLatin1(obfuscated));
}
