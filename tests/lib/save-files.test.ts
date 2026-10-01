import { describe, expect, it } from "vitest";
import { folderNameFromFiles, topLevelSaveFiles } from "../../src/lib/nms/fs-access";
import {
  backupFileName,
  groupSaveSlots,
  identifySaveFile,
  newestOverall,
  newestSave,
  storageFromFolderName,
} from "../../src/lib/nms/save-files";

describe("identifySaveFile", () => {
  it("pairs player saves and autosaves into slots", () => {
    expect(identifySaveFile("save.hg")).toMatchObject({
      slot: 1,
      kind: "manual",
      index: 1,
    });
    expect(identifySaveFile("save2.hg")).toMatchObject({
      slot: 1,
      kind: "auto",
      index: 2,
    });
    expect(identifySaveFile("save3.hg")).toMatchObject({
      slot: 2,
      kind: "manual",
      index: 3,
    });
    expect(identifySaveFile("save4.hg")).toMatchObject({
      slot: 2,
      kind: "auto",
      index: 4,
    });
    expect(identifySaveFile("save10.hg")).toMatchObject({
      slot: 5,
      kind: "auto",
      index: 10,
    });
  });

  it("ignores metadata, account data and backup names", () => {
    expect(identifySaveFile("mf_save4.hg")).toBeNull();
    expect(identifySaveFile("accountdata.hg")).toBeNull();
    expect(identifySaveFile("save4.hg old")).toBeNull();
    expect(identifySaveFile("save4-2026-09-30-15-26-07.hg")).toBeNull();
  });
});

describe("groupSaveSlots", () => {
  const files = [
    { name: "mf_save.hg", lastModified: 9 },
    { name: "save.hg", lastModified: 1 },
    { name: "save2.hg", lastModified: 2 },
    { name: "save4.hg", lastModified: 4 },
    { name: "save3.hg", lastModified: 3 },
    { name: "save4.hg old", lastModified: 8 },
  ];

  it("lists player save before autosave and skips non-saves", () => {
    const slots = groupSaveSlots(files);
    expect(slots.map((slot) => slot.slot)).toEqual([1, 2]);
    expect(slots[1]?.files.map((file) => file.name)).toEqual(["save3.hg", "save4.hg"]);
  });

  it("picks the newest file in a slot, then overall", () => {
    const slots = groupSaveSlots(files);
    const slot2 = slots[1]?.files ?? [];
    expect(newestSave(slot2)?.name).toBe("save4.hg");
    expect(newestOverall(slots)?.name).toBe("save4.hg");
  });

  it("breaks a timestamp tie toward the higher index", () => {
    const slots = groupSaveSlots([
      { name: "save3.hg", lastModified: 10 },
      { name: "save4.hg", lastModified: 10 },
    ]);
    expect(newestOverall(slots)?.name).toBe("save4.hg");
  });
});

describe("topLevelSaveFiles", () => {
  it("keeps saves inside the chosen folder and drops metadata and subfolders", () => {
    const folder = "st_76561198056936612";
    const files = [
      { name: "save4.hg", webkitRelativePath: `${folder}/save4.hg` },
      { name: "save3.hg", webkitRelativePath: `${folder}/save3.hg` },
      { name: "mf_save4.hg", webkitRelativePath: `${folder}/mf_save4.hg` },
      { name: "cache.bin", webkitRelativePath: `${folder}/cache/cache.bin` },
      { name: "save.hg", webkitRelativePath: "save.hg" },
    ];
    expect(topLevelSaveFiles(files).map((file) => file.name)).toEqual([
      "save4.hg",
      "save3.hg",
      "save.hg",
    ]);
    expect(folderNameFromFiles(files)).toBe(folder);
  });
});

describe("storage and backup names", () => {
  it("reads Steam and GOG from the folder name", () => {
    expect(storageFromFolderName("st_76561198056936612")).toBe("Steam");
    expect(storageFromFolderName("DefaultUser")).toBe("GOG");
    expect(storageFromFolderName("NMS")).toBe("Pasta");
  });

  it("stamps backups as YYYY-MM-DD-HH-MM-SS", () => {
    const date = new Date(2026, 8, 30, 15, 26, 7);
    expect(backupFileName("save4.hg", date)).toBe("save4-2026-09-30-15-26-07.hg");
    expect(backupFileName("save.hg", date)).toBe("save-2026-09-30-15-26-07.hg");
  });
});
