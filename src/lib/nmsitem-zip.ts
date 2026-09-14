import { zipSync, strToU8 } from "fflate";
import { downloadBytes, downloadText, safeFilename } from "@/lib/download";
import { serializeNmsItem, type NmsItemFile } from "@/lib/nmsitem";

export function downloadNmsItemFile(item: NmsItemFile) {
  downloadText(
    `${safeFilename(item.name)}-${item.seed}.nmsitem`,
    serializeNmsItem(item),
    "application/json",
  );
}

export function downloadNmsItemZip(archiveName: string, items: NmsItemFile[]) {
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const item of items) {
    let name = `${safeFilename(item.name)}-${item.seed}.nmsitem`;
    let i = 2;
    while (used.has(name)) {
      name = `${safeFilename(item.name)}-${item.seed}-${i}.nmsitem`;
      i++;
    }
    used.add(name);
    files[name] = strToU8(serializeNmsItem(item));
  }
  downloadBytes(archiveName, zipSync(files));
}
