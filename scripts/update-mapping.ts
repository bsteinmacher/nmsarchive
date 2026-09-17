import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAPPING_URL, parseMappingFile } from "../src/lib/nms/mapping.ts";

export async function downloadMappingJson(
  dest = path.join(process.cwd(), "data", "mapping.json"),
  fetchImpl: typeof fetch = fetch,
): Promise<{ version: string; dest: string; entries: number }> {
  const res = await fetchImpl(MAPPING_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao baixar mapping.json (${res.status})`);
  }
  const json: unknown = await res.json();
  const parsed = parseMappingFile(json);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, `${JSON.stringify(json)}\n`);
  return {
    version: parsed.libMBIN_version,
    dest,
    entries: parsed.Mapping.length,
  };
}

async function main() {
  const result = await downloadMappingJson();
  console.log(
    `mapping.json ${result.version} → ${result.dest} (${result.entries} chaves)`,
  );
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replaceAll("\\", "/").endsWith("scripts/update-mapping.ts");

if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
