export type SaveKind = "manual" | "auto";

export type SaveStorage = "Steam" | "GOG" | "Pasta";

/** `save.hg` is index 1. Slot 1 = 1–2, slot 2 = 3–4, and so on. */
export type SaveFileIdentity = {
  name: string;
  slot: number;
  kind: SaveKind;
  index: number;
};

export type SaveFileEntry = SaveFileIdentity & {
  lastModified: number;
};

export type SaveSlot = {
  slot: number;
  files: SaveFileEntry[];
};

const SAVE_FILE_NAME = /^save(\d*)\.hg$/i;

export function identifySaveFile(name: string): SaveFileIdentity | null {
  const match = SAVE_FILE_NAME.exec(name);
  if (!match) return null;
  const index = match[1] === "" ? 1 : Number(match[1]);
  if (!Number.isInteger(index) || index < 1) return null;
  return {
    name,
    slot: Math.ceil(index / 2),
    kind: index % 2 === 1 ? "manual" : "auto",
    index,
  };
}

export function groupSaveSlots(
  files: Array<{ name: string; lastModified: number }>,
): SaveSlot[] {
  const bySlot = new Map<number, SaveFileEntry[]>();
  for (const file of files) {
    const identity = identifySaveFile(file.name);
    if (!identity) continue;
    const list = bySlot.get(identity.slot) ?? [];
    list.push({ ...identity, lastModified: file.lastModified });
    bySlot.set(identity.slot, list);
  }
  return [...bySlot.entries()]
    .sort(([a], [b]) => a - b)
    .map(([slot, list]) => ({
      slot,
      files: list.sort((a, b) => a.index - b.index),
    }));
}

export function newestSave(files: SaveFileEntry[]): SaveFileEntry | null {
  let best: SaveFileEntry | null = null;
  for (const file of files) {
    if (
      !best ||
      file.lastModified > best.lastModified ||
      (file.lastModified === best.lastModified && file.index > best.index)
    ) {
      best = file;
    }
  }
  return best;
}

export function newestOverall(slots: SaveSlot[]): SaveFileEntry | null {
  return newestSave(slots.flatMap((slot) => slot.files));
}

export function storageFromFolderName(name: string): SaveStorage {
  if (/^st_\d+$/i.test(name)) return "Steam";
  if (/^defaultuser$/i.test(name)) return "GOG";
  return "Pasta";
}

export function saveKindLabel(kind: SaveKind): string {
  return kind === "auto" ? "Automático" : "Do jogador";
}

export function formatBackupStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
  const time = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(
    "-",
  );
  return `${day}-${time}`;
}

export function backupFileName(saveName: string, date: Date): string {
  const stem = saveName.replace(/\.hg$/i, "");
  return `${stem}-${formatBackupStamp(date)}.hg`;
}
