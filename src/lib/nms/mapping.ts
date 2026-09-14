export const MAPPING_URL =
  "https://github.com/monkeyman192/MBINCompiler/releases/latest/download/mapping.json";

export type MappingEntry = { Key: string; Value: string };

export type MappingFile = {
  libMBIN_version: string;
  Mapping: MappingEntry[];
};

export type MappingIndex = {
  version: string;
  forward: Map<string, string>;
  reverse: Map<string, string>;
};

export function parseMappingFile(data: unknown): MappingFile {
  if (!data || typeof data !== "object") {
    throw new Error("mapping.json inválido");
  }
  const rec = data as Record<string, unknown>;
  if (!Array.isArray(rec.Mapping)) {
    throw new Error("mapping.json sem array Mapping");
  }
  const Mapping: MappingEntry[] = rec.Mapping.map((entry, i) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`mapping.json: entrada ${i} inválida`);
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.Key !== "string" || typeof item.Value !== "string") {
      throw new Error(`mapping.json: entrada ${i} sem Key/Value`);
    }
    return { Key: item.Key, Value: item.Value };
  });
  return {
    libMBIN_version:
      typeof rec.libMBIN_version === "string" ? rec.libMBIN_version : "unknown",
    Mapping,
  };
}

export function buildMappingIndex(file: MappingFile): MappingIndex {
  const forward = new Map<string, string>();
  const reverse = new Map<string, string>();
  for (const { Key, Value } of file.Mapping) {
    forward.set(Key, Value);
    reverse.set(Value, Key);
  }
  return { version: file.libMBIN_version, forward, reverse };
}

function walk(
  node: unknown,
  lookup: Map<string, string>,
  knownOther: Map<string, string>,
  unknownKeys: Set<string> | null,
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => walk(item, lookup, knownOther, unknownKeys));
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const mapped = lookup.get(key);
      if (mapped !== undefined) {
        out[mapped] = walk(value, lookup, knownOther, unknownKeys);
        continue;
      }
      if (unknownKeys && !knownOther.has(key)) {
        unknownKeys.add(key);
      }
      out[key] = walk(value, lookup, knownOther, unknownKeys);
    }
    return out;
  }
  return node;
}

export function deobfuscate(
  node: unknown,
  index: MappingIndex,
  unknownKeys: Set<string>,
): unknown {
  return walk(node, index.forward, index.reverse, unknownKeys);
}

export function obfuscate(node: unknown, index: MappingIndex): unknown {
  return walk(node, index.reverse, index.forward, null);
}

export function isReadableSave(json: unknown): boolean {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  return typeof (json as Record<string, unknown>).Version === "number";
}
