import { spawn } from "node:child_process";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  backupFileName,
  identifySaveFile,
  storageFromFolderName,
  type SaveStorage,
} from "@/lib/nms/save-files";
import { DATA_DIR } from "@/server/paths";

const CONFIG_PATH = path.join(DATA_DIR, "local-game.json");
const MAX_BYTES = 64 * 1024 * 1024;
const ACCOUNT_DIR = /^(st_\d+|DefaultUser)$/i;

const RELATIVE_ROOTS = [
  ".local/share/Steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/AppData/Roaming/HelloGames/NMS",
  ".local/share/Steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/Application Data/HelloGames/NMS",
  ".steam/steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/AppData/Roaming/HelloGames/NMS",
  ".steam/steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/Application Data/HelloGames/NMS",
  ".steam/debian-installation/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/AppData/Roaming/HelloGames/NMS",
  ".steam/debian-installation/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/Application Data/HelloGames/NMS",
  "snap/steam/common/.local/share/Steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/AppData/Roaming/HelloGames/NMS",
  "snap/steam/common/.local/share/Steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/Application Data/HelloGames/NMS",
  ".var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/AppData/Roaming/HelloGames/NMS",
  ".var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/compatdata/275850/pfx/drive_c/users/steamuser/Application Data/HelloGames/NMS",
];

export type GameFolderInfo = {
  path: string;
  name: string;
  storage: SaveStorage;
  newest: number;
};

export type GameFolderFile = {
  name: string;
  lastModified: number;
};

export type GameFolderStatus = {
  folders: GameFolderInfo[];
  selectedPath: string | null;
  selectedName: string | null;
  backupDir: string | null;
  files: GameFolderFile[];
};

type LocalGameConfig = {
  saveDir: string | null;
  backupDir: string | null;
  dismissed: boolean;
};

export function chooseRememberedFolder(input: {
  dismissed: boolean;
  configured: string | null;
  newestPath: string | null;
}): string | null {
  if (input.dismissed) return null;
  if (input.configured) return input.configured;
  return input.newestPath;
}

export class GameFolderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly lastModified?: number,
  ) {
    super(message);
    this.name = "GameFolderError";
  }
}

export function nmsCandidateRoots(home: string): string[] {
  return RELATIVE_ROOTS.map((rel) => path.join(home, rel));
}

export function documentsDirectory(home: string, userDirsText: string | null): string {
  const line = userDirsText
    ?.split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("XDG_DOCUMENTS_DIR="));
  if (line) {
    const raw = line
      .slice("XDG_DOCUMENTS_DIR=".length)
      .trim()
      .replace(/^"|"$/g, "");
    const expanded = raw.replaceAll("$HOME", home).replaceAll("${HOME}", home);
    if (expanded && path.isAbsolute(expanded)) return expanded;
  }
  return path.join(home, "Documents");
}

export function isInside(parent: string, candidate: string): boolean {
  const root = path.resolve(parent);
  const full = path.resolve(candidate);
  return full === root || full.startsWith(root + path.sep);
}

export function saveFilePath(saveDir: string, name: string): string {
  if (name !== path.basename(name) || name.includes("\0")) {
    throw new GameFolderError("Nome de arquivo inválido.", 400);
  }
  if (!identifySaveFile(name)) {
    throw new GameFolderError("Só entra arquivo save.hg.", 400);
  }
  const full = path.resolve(saveDir, name);
  if (path.dirname(full) !== path.resolve(saveDir)) {
    throw new GameFolderError("O arquivo precisa ficar na pasta do jogo.", 400);
  }
  return full;
}

export function isLocalRequest(req: Request): boolean {
  const hostHeader = req.headers.get("host");
  const hostname = (hostHeader ?? new URL(req.url).host)
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "");
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") {
    return false;
  }
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).hostname;
    return originHost === "localhost" || originHost === "127.0.0.1" || originHost === "::1";
  } catch {
    return false;
  }
}

async function readConfig(): Promise<LocalGameConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8")) as Partial<LocalGameConfig>;
    return {
      saveDir: typeof raw.saveDir === "string" ? raw.saveDir : null,
      backupDir: typeof raw.backupDir === "string" ? raw.backupDir : null,
      dismissed: raw.dismissed === true,
    };
  } catch {
    return { saveDir: null, backupDir: null, dismissed: false };
  }
}

async function writeConfig(config: LocalGameConfig) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

async function newestSaveStamp(dir: string): Promise<number | null> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  let newest = 0;
  let found = false;
  for (const entry of entries) {
    if (!entry.isFile() || !identifySaveFile(entry.name)) continue;
    found = true;
    const stat = await fs.stat(path.join(dir, entry.name));
    if (stat.mtimeMs > newest) newest = stat.mtimeMs;
  }
  return found ? newest : null;
}

export async function discoverAt(roots: string[], home: string): Promise<GameFolderInfo[]> {
  const homeReal = await fs.realpath(home).catch(() => path.resolve(home));
  const found = new Map<string, GameFolderInfo>();
  for (const root of roots) {
    let realRoot: string;
    try {
      realRoot = await fs.realpath(root);
    } catch {
      continue;
    }
    if (!isInside(homeReal, realRoot)) continue;
    const rootNewest = await newestSaveStamp(realRoot);
    if (rootNewest != null) {
      const name = path.basename(realRoot);
      found.set(realRoot, {
        path: realRoot,
        name,
        storage: storageFromFolderName(name),
        newest: Math.round(rootNewest),
      });
    }
    let children;
    try {
      children = await fs.readdir(realRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (!child.isDirectory() || !ACCOUNT_DIR.test(child.name)) continue;
      let realChild: string;
      try {
        realChild = await fs.realpath(path.join(realRoot, child.name));
      } catch {
        continue;
      }
      if (!isInside(homeReal, realChild)) continue;
      const newest = await newestSaveStamp(realChild);
      if (newest == null) continue;
      found.set(realChild, {
        path: realChild,
        name: child.name,
        storage: storageFromFolderName(child.name),
        newest: Math.round(newest),
      });
    }
  }
  return [...found.values()].sort((a, b) => b.newest - a.newest || a.name.localeCompare(b.name));
}

export async function listSaveFiles(saveDir: string): Promise<GameFolderFile[]> {
  const entries = await fs.readdir(saveDir, { withFileTypes: true });
  const files: GameFolderFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !identifySaveFile(entry.name)) continue;
    const stat = await fs.stat(path.join(saveDir, entry.name));
    files.push({ name: entry.name, lastModified: Math.round(stat.mtimeMs) });
  }
  return files;
}

async function defaultBackupDir(home: string): Promise<string> {
  let text: string | null = null;
  try {
    text = await fs.readFile(path.join(home, ".config", "user-dirs.dirs"), "utf8");
  } catch {
    text = null;
  }
  const dir = path.join(documentsDirectory(home, text), "NMS Archive");
  await fs.mkdir(dir, { recursive: true });
  return fs.realpath(dir);
}

async function resolvedBackupDir(home: string, config: LocalGameConfig): Promise<string> {
  if (config.backupDir) {
    try {
      const real = await fs.realpath(config.backupDir);
      const homeReal = await fs.realpath(home);
      if (isInside(homeReal, real)) return real;
    } catch {
      // Recreate the default folder below.
    }
  }
  const backupDir = await defaultBackupDir(home);
  await writeConfig({ ...config, backupDir });
  return backupDir;
}

export async function gameFolderStatus(home: string): Promise<GameFolderStatus> {
  const folders = await discoverAt(nmsCandidateRoots(home), home);
  const config = await readConfig();
  let selectedPath =
    config.saveDir && folders.some((folder) => folder.path === config.saveDir)
      ? config.saveDir
      : null;
  if (!selectedPath && config.saveDir) {
    try {
      const real = await fs.realpath(config.saveDir);
      const homeReal = await fs.realpath(home);
      if (isInside(homeReal, real) && (await newestSaveStamp(real)) != null) {
        selectedPath = real;
      }
    } catch {
      selectedPath = null;
    }
  }
  selectedPath = chooseRememberedFolder({
    dismissed: config.dismissed,
    configured: selectedPath,
    newestPath: folders[0]?.path ?? null,
  });
  if (selectedPath && selectedPath !== config.saveDir) {
    await writeConfig({ ...config, saveDir: selectedPath, dismissed: false });
  }
  const backupDir = await resolvedBackupDir(home, {
    ...config,
    saveDir: selectedPath,
  });
  const files = selectedPath ? await listSaveFiles(selectedPath) : [];
  return {
    folders,
    selectedPath,
    selectedName: selectedPath ? path.basename(selectedPath) : null,
    backupDir,
    files,
  };
}

export async function selectGameFolder(home: string, requested: string): Promise<GameFolderStatus> {
  const homeReal = await fs.realpath(home);
  let real: string;
  try {
    real = await fs.realpath(requested);
  } catch {
    throw new GameFolderError("Essa pasta não existe.", 404);
  }
  if (!isInside(homeReal, real)) {
    throw new GameFolderError("A pasta precisa estar neste computador, na sua conta.", 400);
  }
  if ((await newestSaveStamp(real)) == null) {
    throw new GameFolderError("Nenhum save.hg nessa pasta.", 400);
  }
  const config = await readConfig();
  await writeConfig({ ...config, saveDir: real, dismissed: false });
  return gameFolderStatus(home);
}

export function zenityDirectoryArgs(startDir: string): string[] {
  const folder = startDir.endsWith(path.sep) ? startDir : `${startDir}${path.sep}`;
  return ["--file-selection", "--directory", "--title=Pasta dos saves", `--filename=${folder}`];
}

export function zenityDirectoryResult(code: number | null, stdout: string): string | null {
  if (code === 1) return null;
  if (code !== 0) {
    throw new GameFolderError("Não consegui abrir o seletor de pasta.", 500);
  }
  const picked = stdout.trim();
  if (!picked) throw new GameFolderError("O seletor não devolveu a pasta.", 500);
  return picked;
}

async function zenityBin(): Promise<string | null> {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, "zenity");
    try {
      await fs.access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep looking.
    }
  }
  return null;
}

export async function pickDirectoryDialog(startDir: string): Promise<string | null> {
  const bin = await zenityBin();
  if (!bin) {
    throw new GameFolderError("Não achei um seletor de pasta neste computador.", 500);
  }
  const child = spawn(bin, zenityDirectoryArgs(startDir), { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", () => {
      reject(new GameFolderError("Não consegui abrir o seletor de pasta.", 500));
    });
    child.on("close", (status) => resolve(status));
  });
  return zenityDirectoryResult(code, stdout);
}

export async function clearGameFolder(home: string): Promise<GameFolderStatus> {
  const config = await readConfig();
  await writeConfig({ ...config, saveDir: null, dismissed: true });
  return gameFolderStatus(home);
}

export async function readSaveFile(
  home: string,
  name: string,
): Promise<{ bytes: Buffer; lastModified: number }> {
  const status = await gameFolderStatus(home);
  if (!status.selectedPath) {
    throw new GameFolderError("Nenhuma pasta do jogo escolhida.", 404);
  }
  const target = saveFilePath(status.selectedPath, name);
  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    throw new GameFolderError("Esse arquivo não está na pasta.", 404);
  }
  if (!stat.isFile()) throw new GameFolderError("Esse arquivo não está na pasta.", 404);
  return { bytes: await fs.readFile(target), lastModified: Math.round(stat.mtimeMs) };
}

export async function writeSaveInPlace(options: {
  saveDir: string;
  backupDir: string;
  name: string;
  bytes: Uint8Array;
  now: Date;
  expectedModified?: number | null;
}): Promise<{ backupName: string; lastModified: number }> {
  if (options.bytes.byteLength > MAX_BYTES) {
    throw new GameFolderError("Arquivo grande demais.", 413);
  }
  const target = saveFilePath(options.saveDir, options.name);
  let currentStat;
  try {
    currentStat = await fs.stat(target);
  } catch {
    throw new GameFolderError("Esse arquivo não está na pasta.", 404);
  }
  const lastModified = Math.round(currentStat.mtimeMs);
  if (
    options.expectedModified != null &&
    Math.abs(Math.round(options.expectedModified) - lastModified) > 1
  ) {
    throw new GameFolderError("O arquivo no disco mudou.", 409, lastModified);
  }
  await fs.mkdir(options.backupDir, { recursive: true });
  const backupRoot = await fs.realpath(options.backupDir);
  let backupName = backupFileName(options.name, options.now);
  let backupPath = path.join(backupRoot, backupName);
  try {
    await fs.access(backupPath);
    const suffix = String(options.now.getMilliseconds()).padStart(3, "0");
    backupName = backupName.replace(/\.hg$/i, `-${suffix}.hg`);
    backupPath = path.join(backupRoot, backupName);
  } catch {
    // The stamp is free.
  }
  if (path.dirname(path.resolve(backupPath)) !== backupRoot) {
    throw new GameFolderError("O backup sairia da pasta escolhida.", 400);
  }
  const current = await fs.readFile(target);
  await fs.writeFile(backupPath, current);
  const tmp = `${target}.nmsarchive-tmp`;
  await fs.writeFile(tmp, options.bytes);
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
  const updated = await fs.stat(target);
  return { backupName, lastModified: Math.round(updated.mtimeMs) };
}

export async function writeSelectedSave(
  home: string,
  name: string,
  bytes: Uint8Array,
  expectedModified: number | null,
  now = new Date(),
): Promise<{ backupName: string; lastModified: number; fileName: string }> {
  const status = await gameFolderStatus(home);
  if (!status.selectedPath || !status.backupDir) {
    throw new GameFolderError("Nenhuma pasta do jogo escolhida.", 404);
  }
  const written = await writeSaveInPlace({
    saveDir: status.selectedPath,
    backupDir: status.backupDir,
    name,
    bytes,
    now,
    expectedModified,
  });
  return { ...written, fileName: name };
}
