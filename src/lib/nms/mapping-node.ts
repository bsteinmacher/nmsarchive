import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MAPPING_URL,
  parseMappingFile,
  type MappingFile,
} from "./mapping";

export const MAPPING_CACHE_PATH = path.join(
  process.cwd(),
  "data",
  "mapping.json",
);

export async function loadMappingCached(): Promise<MappingFile> {
  try {
    const raw = await readFile(MAPPING_CACHE_PATH, "utf8");
    return parseMappingFile(JSON.parse(raw));
  } catch {
    const res = await fetch(MAPPING_URL);
    if (!res.ok) {
      throw new Error(`Falha ao baixar mapping.json (${res.status})`);
    }
    const json: unknown = await res.json();
    const parsed = parseMappingFile(json);
    await mkdir(path.dirname(MAPPING_CACHE_PATH), { recursive: true });
    await writeFile(MAPPING_CACHE_PATH, JSON.stringify(json));
    return parsed;
  }
}
