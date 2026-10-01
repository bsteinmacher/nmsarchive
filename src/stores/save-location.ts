"use client";

import { create } from "zustand";
import { set as idbSet } from "idb-keyval";
import {
  askPermission,
  backupExists,
  fsErrorMessage,
  listSaveHandles,
  pickDirectory,
  readPermission,
  writeFileBytes,
  writeNewFile,
  type FsDirectoryHandle,
  type FsFileHandle,
  type FsPermission,
} from "@/lib/nms/fs-access";
import {
  backupFileName,
  groupSaveSlots,
  newestOverall,
  newestSave,
  type SaveFileEntry,
  type SaveSlot,
} from "@/lib/nms/save-files";
import { useSaveSession } from "@/stores/save-session";

const IDB_BACKUP_DIR = "nmsarchive:v1:backup-dir";

export type SlotSummary = {
  gameModeLabel: string;
  saveName: string;
  lastModified: number;
};

export type LocalFolder = {
  path: string;
  name: string;
  storage: "Steam" | "GOG" | "Pasta";
};

type LocalStatus = {
  folders: Array<LocalFolder & { newest: number }>;
  selectedPath: string | null;
  selectedName: string | null;
  backupDir: string | null;
  files: Array<{ name: string; lastModified: number }>;
};

export type SaveInPlaceResult =
  | { status: "saved"; backupName: string; fileName: string }
  | {
      status: "export";
      backupName: string;
      fileName: string;
      bytes: Uint8Array;
      backupBytes: Uint8Array;
    }
  | { status: "cancelled" }
  | { status: "stale" }
  | { status: "unbound" };

type SaveLocationState = {
  supported: boolean;
  hydrated: boolean;
  saveFolderName: string | null;
  saveFolderPath: string | null;
  localFolders: LocalFolder[];
  savePermission: FsPermission | "missing";
  backupFolderName: string | null;
  backupPermission: FsPermission | "missing";
  scanning: boolean;
  writing: boolean;
  slots: SaveSlot[];
  summaries: Record<string, SlotSummary>;
  selectedName: string | null;
  boundName: string | null;
  diskStale: boolean;
  writable: boolean;
  error: string | null;
  hydrateLocation: () => Promise<void>;
  chooseSaveFolder: () => Promise<void>;
  selectLocalFolder: (folderPath: string) => Promise<void>;
  clearLocalFolder: () => Promise<void>;
  resumeSaveFolder: () => Promise<void>;
  chooseBackupFolder: () => Promise<void>;
  reloadFromDisk: () => Promise<void>;
  selectSlot: (slot: number) => Promise<void>;
  selectFile: (name: string) => Promise<void>;
  saveInPlace: (force?: boolean) => Promise<SaveInPlaceResult>;
};

let saveDir: FsDirectoryHandle | null = null;
let backupDir: FsDirectoryHandle | null = null;
let localActive = false;
const handles = new Map<string, FsFileHandle>();
const looseFiles = new Map<string, File>();
let summaryToken = 0;

function modifiedMatches(disk: number, session: number | null | undefined) {
  if (session == null) return true;
  return Math.abs(disk - session) <= 1;
}

function selectedEntry(slots: SaveSlot[], name: string | null): SaveFileEntry | null {
  if (!name) return null;
  for (const slot of slots) {
    const file = slot.files.find((entry) => entry.name === name);
    if (file) return file;
  }
  return null;
}

function withModified(slots: SaveSlot[], name: string, lastModified: number): SaveSlot[] {
  return slots.map((slot) => ({
    ...slot,
    files: slot.files.map((file) =>
      file.name === name ? { ...file, lastModified } : file,
    ),
  }));
}

function rememberHandle(key: string, handle: FsDirectoryHandle) {
  void idbSet(key, handle).catch(() => undefined);
}

async function rememberBackup(dir: FsDirectoryHandle) {
  backupDir = dir;
  useSaveLocation.setState({
    backupFolderName: dir.name,
    backupPermission: "granted",
  });
  rememberHandle(IDB_BACKUP_DIR, dir);
}

async function ensureBackupDir(): Promise<FsDirectoryHandle | null> {
  if (!backupDir) {
    const picked = await pickDirectory({
      id: "nmsarchive-save-backups",
      startIn: "documents",
      mode: "readwrite",
    });
    if (!picked) return null;
    await rememberBackup(picked);
    return picked;
  }
  const permission = await readPermission(backupDir, "readwrite");
  if (permission === "granted") return backupDir;
  const asked = await askPermission(backupDir, "readwrite");
  if (asked === "granted") {
    useSaveLocation.setState({ backupPermission: "granted" });
    return backupDir;
  }
  const picked = await pickDirectory({
    id: "nmsarchive-save-backups",
    startIn: "documents",
    mode: "readwrite",
  });
  if (!picked) return null;
  await rememberBackup(picked);
  return picked;
}

async function backupNameFor(dir: FsDirectoryHandle, saveName: string, date: Date) {
  const base = backupFileName(saveName, date);
  if (!(await backupExists(dir, base))) return base;
  const pad = (value: number) => String(value).padStart(3, "0");
  return base.replace(/\.hg$/i, `-${pad(date.getMilliseconds())}.hg`);
}

async function apiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // The body was not JSON.
  }
  return "Não deu para falar com a pasta do jogo neste computador.";
}

async function fetchLocalStatus(): Promise<LocalStatus> {
  const res = await fetch("/api/game-folder");
  if (!res.ok) throw new Error(await apiError(res));
  return (await res.json()) as LocalStatus;
}

async function fetchLocalFile(name: string): Promise<File> {
  const res = await fetch(`/api/game-folder/file?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(await apiError(res));
  const lastModified = Number(res.headers.get("x-last-modified"));
  const bytes = await res.arrayBuffer();
  return new File([bytes], name, {
    lastModified: Number.isFinite(lastModified) ? lastModified : Date.now(),
  });
}

async function fileFor(name: string): Promise<File> {
  if (localActive) return fetchLocalFile(name);
  const handle = handles.get(name);
  if (handle) return handle.getFile();
  const loose = looseFiles.get(name);
  if (loose) return loose;
  throw new Error("Esse arquivo não está mais na pasta.");
}

async function openHandle(name: string) {
  const file = await fileFor(name);
  await useSaveSession.getState().loadFile(file, { origin: "directory" });
  const summary = useSaveSession.getState().summary;
  useSaveLocation.setState((state) => ({
    selectedName: name,
    boundName: name,
    diskStale: false,
    slots: withModified(state.slots, name, file.lastModified),
    summaries: summary
      ? {
          ...state.summaries,
          [name]: {
            gameModeLabel: summary.gameModeLabel,
            saveName: summary.saveName,
            lastModified: file.lastModified,
          },
        }
      : state.summaries,
  }));
}

async function fillSummaries(token: number) {
  const { slots, selectedName } = useSaveLocation.getState();
  const selectedSlot = slots.find((slot) =>
    slot.files.some((file) => file.name === selectedName),
  );
  const ordered = [
    ...(selectedSlot?.files ?? []),
    ...slots
      .filter((slot) => slot.slot !== selectedSlot?.slot)
      .flatMap((slot) => slot.files),
  ];
  for (const entry of ordered) {
    if (token !== summaryToken) return;
    const session = useSaveSession.getState();
    if (
      session.fileName === entry.name &&
      session.summary &&
      session.origin === "directory" &&
      !useSaveLocation.getState().diskStale
    ) {
      useSaveLocation.setState((state) => ({
        summaries: {
          ...state.summaries,
          [entry.name]: {
            gameModeLabel: session.summary!.gameModeLabel,
            saveName: session.summary!.saveName,
            lastModified: entry.lastModified,
          },
        },
      }));
      continue;
    }
    const known = useSaveLocation.getState().summaries[entry.name];
    if (known && known.lastModified === entry.lastModified) continue;
    if (!localActive && !handles.has(entry.name) && !looseFiles.has(entry.name)) continue;
    try {
      const file = await fileFor(entry.name);
      const summary = await useSaveSession.getState().previewFile(file);
      if (token !== summaryToken) return;
      useSaveLocation.setState((state) => ({
        summaries: {
          ...state.summaries,
          [entry.name]: {
            gameModeLabel: summary.gameModeLabel,
            saveName: summary.saveName,
            lastModified: file.lastModified,
          },
        },
      }));
    } catch {
      // The slot stays numbered until a later reload.
    }
  }
}

async function scan(options: { autoload: boolean; reloadSelected: boolean }) {
  if (!saveDir) return;
  const token = ++summaryToken;
  useSaveLocation.setState({ scanning: true, error: null });
  try {
    const listed = await listSaveHandles(saveDir);
    if (token !== summaryToken) return;
    handles.clear();
    looseFiles.clear();
    for (const entry of listed) handles.set(entry.name, entry.handle);
    const slots = groupSaveSlots(listed);
    const session = useSaveSession.getState();
    const match = listed.find((entry) => entry.name === session.fileName);
    const bound =
      !options.autoload &&
      match &&
      session.origin === "directory" &&
      session.status === "ready"
        ? match.name
        : null;
    const diskStale = Boolean(
      bound && match && !modifiedMatches(match.lastModified, session.diskModified),
    );
    const remembered = options.autoload ? null : useSaveLocation.getState().selectedName;
    const preferred = bound ?? remembered ?? newestOverall(slots)?.name ?? null;
    const selectedName = slots.some((slot) =>
      slot.files.some((file) => file.name === preferred),
    )
      ? preferred
      : (newestOverall(slots)?.name ?? null);

    useSaveLocation.setState({
      slots,
      summaries: {},
      selectedName,
      boundName: bound,
      diskStale,
      scanning: false,
      writable: true,
      savePermission: "granted",
      error:
        slots.length === 0
          ? "Nenhum save.hg nessa pasta. No Steam o nome termina em st_ e o número da conta."
          : null,
    });

    const shouldOpen = Boolean(
      selectedName &&
        (options.reloadSelected ||
          options.autoload ||
          (session.status === "idle" && !bound)),
    );
    if (shouldOpen && selectedName) {
      try {
        await openHandle(selectedName);
      } catch (err) {
        if (token !== summaryToken) return;
        throw err;
      }
    }
    void fillSummaries(token);
  } catch (err) {
    if (token !== summaryToken) return;
    useSaveLocation.setState({
      scanning: false,
      error: fsErrorMessage(err),
    });
  }
}

async function applyLocal(
  status: LocalStatus,
  options: { autoload: boolean; reloadSelected: boolean },
) {
  const token = ++summaryToken;
  localActive = Boolean(status.selectedPath);
  handles.clear();
  looseFiles.clear();
  saveDir = null;
  const slots = groupSaveSlots(status.files);
  const session = useSaveSession.getState();
  const match = status.files.find((entry) => entry.name === session.fileName);
  const bound =
    !options.autoload &&
    match &&
    session.origin === "directory" &&
    session.status === "ready"
      ? match.name
      : null;
  const diskStale = Boolean(
    bound && match && !modifiedMatches(match.lastModified, session.diskModified),
  );
  const remembered = options.autoload ? null : useSaveLocation.getState().selectedName;
  const preferred = bound ?? remembered ?? newestOverall(slots)?.name ?? null;
  const selectedName = slots.some((slot) =>
    slot.files.some((file) => file.name === preferred),
  )
    ? preferred
    : (newestOverall(slots)?.name ?? null);

  useSaveLocation.setState({
    supported: true,
    hydrated: true,
    scanning: false,
    writable: localActive,
    saveFolderName: status.selectedName,
    saveFolderPath: status.selectedPath,
    localFolders: status.folders.map(({ path, name, storage }) => ({ path, name, storage })),
    savePermission: localActive ? "granted" : "missing",
    backupFolderName: status.backupDir,
    backupPermission: status.backupDir ? "granted" : "missing",
    slots,
    summaries: {},
    selectedName,
    boundName: bound,
    diskStale,
    error:
      status.selectedPath && slots.length === 0 ? "Nenhum save.hg nessa pasta." : null,
  });

  const shouldOpen = Boolean(
    selectedName &&
      localActive &&
      (options.reloadSelected || options.autoload || (session.status === "idle" && !bound)),
  );
  if (shouldOpen && selectedName) {
    await openHandle(selectedName);
  }
  if (token === summaryToken) void fillSummaries(token);
}

export const useSaveLocation = create<SaveLocationState>((set, get) => ({
  supported: false,
  hydrated: false,
  saveFolderName: null,
  saveFolderPath: null,
  localFolders: [],
  savePermission: "missing",
  backupFolderName: null,
  backupPermission: "missing",
  scanning: false,
  writing: false,
  slots: [],
  summaries: {},
  selectedName: null,
  boundName: null,
  diskStale: false,
  writable: false,
  error: null,

  hydrateLocation: async () => {
    if (get().hydrated) return;
    set({ supported: true, scanning: true });
    try {
      await applyLocal(await fetchLocalStatus(), {
        autoload: false,
        reloadSelected: false,
      });
      return;
    } catch (err) {
      set({
        scanning: false,
        hydrated: true,
        supported: true,
        error: err instanceof Error ? err.message : "Não achei a pasta do jogo.",
      });
      return;
    }
  },

  chooseSaveFolder: async () => {
    set({ scanning: true, error: null });
    try {
      await applyLocal(await fetchLocalStatus(), {
        autoload: false,
        reloadSelected: false,
      });
    } catch (err) {
      set({
        scanning: false,
        error: err instanceof Error ? err.message : "Não achei a pasta do jogo.",
      });
    }
  },

  selectLocalFolder: async (folderPath) => {
    set({ scanning: true, error: null });
    const res = await fetch("/api/game-folder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: folderPath }),
    });
    if (!res.ok) {
      set({ scanning: false, error: await apiError(res) });
      return;
    }
    await applyLocal((await res.json()) as LocalStatus, {
      autoload: true,
      reloadSelected: true,
    });
  },

  clearLocalFolder: async () => {
    set({ scanning: true, error: null });
    const res = await fetch("/api/game-folder", { method: "DELETE" });
    if (!res.ok) {
      set({ scanning: false, error: await apiError(res) });
      return;
    }
    await applyLocal((await res.json()) as LocalStatus, {
      autoload: false,
      reloadSelected: false,
    });
  },

  resumeSaveFolder: async () => {
    if (!saveDir) return;
    const permission = await askPermission(saveDir);
    set({ savePermission: permission });
    if (permission !== "granted") {
      set({ error: "Sem permissão para ler essa pasta." });
      return;
    }
    await scan({ autoload: false, reloadSelected: false });
  },

  chooseBackupFolder: async () => {
    const dir = await pickDirectory({
      id: "nmsarchive-save-backups",
      startIn: "documents",
      mode: "readwrite",
    });
    if (!dir) return;
    await rememberBackup(dir);
  },

  reloadFromDisk: async () => {
    if (localActive) {
      await applyLocal(await fetchLocalStatus(), {
        autoload: false,
        reloadSelected: true,
      });
      return;
    }
    if (saveDir) {
      await scan({ autoload: false, reloadSelected: true });
      return;
    }
    const name = get().selectedName;
    if (name && looseFiles.has(name)) await openHandle(name);
  },

  selectSlot: async (slotNumber) => {
    const slot = get().slots.find((entry) => entry.slot === slotNumber);
    const next = slot ? newestSave(slot.files) : null;
    if (!next) return;
    if (next.name === get().boundName && !get().diskStale) {
      set({ selectedName: next.name });
      return;
    }
    set({ selectedName: next.name });
    await openHandle(next.name);
  },

  selectFile: async (name) => {
    if (!localActive && !handles.has(name) && !looseFiles.has(name)) return;
    if (name === get().boundName && !get().diskStale) {
      set({ selectedName: name });
      return;
    }
    set({ selectedName: name });
    await openHandle(name);
  },

  saveInPlace: async (force = false) => {
    const boundName = get().boundName;
    const handle = boundName ? handles.get(boundName) : undefined;
    const session = useSaveSession.getState();
    if (
      !boundName ||
      session.origin !== "directory" ||
      session.fileName !== boundName ||
      session.status !== "ready"
    ) {
      return { status: "unbound" };
    }
    if (localActive) {
      set({ writing: true, error: null });
      try {
        const rewritten = await useSaveSession.getState().downloadRewritten();
        const headers: Record<string, string> = {
          "content-type": "application/octet-stream",
          "x-save-name": boundName,
        };
        if (!force && session.diskModified != null) {
          headers["x-last-modified"] = String(session.diskModified);
        }
        const res = await fetch("/api/game-folder/file", {
          method: "POST",
          headers,
          body: new Blob([rewritten]),
        });
        if (res.status === 409) {
          const body = (await res.json()) as { lastModified?: number };
          const lastModified = body.lastModified ?? Date.now();
          set({
            writing: false,
            diskStale: true,
            slots: withModified(get().slots, boundName, lastModified),
          });
          return { status: "stale" };
        }
        if (!res.ok) throw new Error(await apiError(res));
        const written = (await res.json()) as { backupName: string; lastModified: number };
        await useSaveSession.getState().noteDiskWrite(written.lastModified, rewritten);
        set({
          writing: false,
          diskStale: false,
          slots: withModified(get().slots, boundName, written.lastModified),
        });
        return { status: "saved" as const, backupName: written.backupName, fileName: boundName };
      } catch (err) {
        set({ writing: false, error: fsErrorMessage(err) });
        throw err;
      }
    }
    if (!handle) {
      const loose = looseFiles.get(boundName);
      if (!loose) return { status: "unbound" };
      set({ writing: true, error: null });
      try {
        const backupBytes = new Uint8Array(await loose.arrayBuffer());
        const bytes = await useSaveSession.getState().downloadRewritten();
        set({ writing: false });
        return {
          status: "export" as const,
          backupName: backupFileName(boundName, new Date()),
          fileName: boundName,
          bytes,
          backupBytes,
        };
      } catch (err) {
        set({ writing: false, error: fsErrorMessage(err) });
        throw err;
      }
    }
    const disk = await handle.getFile();
    if (!force && !modifiedMatches(disk.lastModified, session.diskModified)) {
      set({
        diskStale: true,
        slots: withModified(get().slots, boundName, disk.lastModified),
      });
      return { status: "stale" };
    }
    const dir = await ensureBackupDir();
    if (!dir) return { status: "cancelled" };
    set({ writing: true, error: null });
    try {
      const fresh = await handle.getFile();
      const diskBytes = new Uint8Array(await fresh.arrayBuffer());
      const backupName = await backupNameFor(dir, handle.name, new Date());
      await writeNewFile(dir, backupName, diskBytes);
      const rewritten = await useSaveSession.getState().downloadRewritten();
      await writeFileBytes(handle, rewritten);
      const updated = await handle.getFile();
      await useSaveSession.getState().noteDiskWrite(updated.lastModified, rewritten);
      set({
        writing: false,
        diskStale: false,
        slots: withModified(get().slots, boundName, updated.lastModified),
      });
      return { status: "saved", backupName, fileName: boundName };
    } catch (err) {
      set({ writing: false, error: fsErrorMessage(err) });
      throw err;
    }
  },
}));

useSaveSession.subscribe((state, prev) => {
  if (state.origin === "directory") return;
  if (state.fileName === prev.fileName && state.origin === prev.origin) return;
  useSaveLocation.setState({ boundName: null, diskStale: false });
});

export function entryFor(slots: SaveSlot[], name: string | null): SaveFileEntry | null {
  return selectedEntry(slots, name);
}
