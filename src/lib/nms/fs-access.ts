import { identifySaveFile } from "@/lib/nms/save-files";

export type FsPermission = "granted" | "denied" | "prompt";

export interface FsWritable {
  write: (data: Uint8Array<ArrayBuffer> | Blob) => Promise<void>;
  close: () => Promise<void>;
}

export interface FsFileHandle {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<FsWritable>;
}

export interface FsDirectoryHandle {
  kind: "directory";
  name: string;
  queryPermission: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<FsPermission>;
  requestPermission: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<FsPermission>;
  values: () => AsyncIterable<FsFileHandle | FsDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FsFileHandle>;
}

type DirectoryPickerOptions = {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: "documents" | "desktop" | "downloads" | FsDirectoryHandle;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FsDirectoryHandle>;
  }
}

const READ = { mode: "read" as const };
const WRITE = { mode: "readwrite" as const };

export function canPickDirectory(): boolean {
  return typeof window !== "undefined";
}

function relativeParts(file: { name: string; webkitRelativePath?: string }): string[] {
  const relative = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
  return relative.split("/").filter(Boolean);
}

export function topLevelSaveFiles<T extends { name: string; webkitRelativePath?: string }>(
  files: T[],
): T[] {
  return files.filter((file) => {
    const parts = relativeParts(file);
    const base = parts[parts.length - 1] ?? file.name;
    // The picker prefixes the chosen folder: `st_123/save4.hg`.
    if (parts.length > 2) return false;
    return identifySaveFile(base) != null;
  });
}

export function folderNameFromFiles(
  files: Array<{ name: string; webkitRelativePath?: string }>,
): string {
  for (const file of files) {
    const parts = relativeParts(file);
    if (parts.length >= 2 && parts[0]) return parts[0];
  }
  return "Pasta escolhida";
}

export function pickSaveFolderFiles(): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    let settled = false;
    const finish = (files: File[] | null) => {
      if (settled) return;
      settled = true;
      resolve(files);
    };
    input.addEventListener("change", () => {
      const list = input.files ? [...input.files] : [];
      finish(list.length ? list : null);
    });
    input.addEventListener("cancel", () => finish(null));
    input.click();
  });
}

export function isPickerAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function fsErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return "O navegador bloqueou a pasta. Escolha de novo para autorizar a gravação.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Falha ao acessar a pasta.";
}

export async function pickDirectory(options: {
  id: string;
  startIn?: "documents";
  mode?: "read" | "readwrite";
}): Promise<FsDirectoryHandle | null> {
  const picker = window.showDirectoryPicker;
  if (!picker) {
    throw new Error("Este navegador não abre pasta. Use Chromium, ou solte o save.hg.");
  }
  try {
    return await picker({
      id: options.id,
      startIn: options.startIn,
      mode: options.mode ?? "read",
    });
  } catch (err) {
    if (isPickerAbort(err)) return null;
    throw err;
  }
}

export async function readPermission(
  handle: FsDirectoryHandle,
  mode: "read" | "readwrite" = "read",
): Promise<FsPermission> {
  try {
    return await handle.queryPermission(mode === "readwrite" ? WRITE : READ);
  } catch {
    return "prompt";
  }
}

export async function askPermission(
  handle: FsDirectoryHandle,
  mode: "read" | "readwrite" = "read",
): Promise<FsPermission> {
  try {
    return await handle.requestPermission(mode === "readwrite" ? WRITE : READ);
  } catch (err) {
    if (isPickerAbort(err)) return "denied";
    throw err;
  }
}

export async function listSaveHandles(
  dir: FsDirectoryHandle,
): Promise<Array<{ name: string; lastModified: number; handle: FsFileHandle }>> {
  const found: Array<{ name: string; lastModified: number; handle: FsFileHandle }> = [];
  for await (const entry of dir.values()) {
    if (entry.kind !== "file" || !identifySaveFile(entry.name)) continue;
    const handle = entry as FsFileHandle;
    const file = await handle.getFile();
    found.push({ name: file.name, lastModified: file.lastModified, handle });
  }
  return found;
}

export async function writeFileBytes(handle: FsFileHandle, bytes: Uint8Array) {
  const writable = await handle.createWritable();
  const payload = new Uint8Array(bytes);
  try {
    await writable.write(payload);
    await writable.close();
  } catch (err) {
    await writable.close().catch(() => undefined);
    throw err;
  }
}

export async function backupExists(dir: FsDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

export async function writeNewFile(
  dir: FsDirectoryHandle,
  name: string,
  bytes: Uint8Array,
) {
  const handle = await dir.getFileHandle(name, { create: true });
  await writeFileBytes(handle, bytes);
}
