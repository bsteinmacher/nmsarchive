import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  chooseRememberedFolder,
  zenityDirectoryArgs,
  zenityDirectoryResult,
  discoverAt,
  documentsDirectory,
  isInside,
  isLocalRequest,
  saveFilePath,
  writeSaveInPlace,
  GameFolderError,
} from "@/server/game-folder";

const temps: string[] = [];

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function tempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nms-game-folder-"));
  temps.push(dir);
  return dir;
}

describe("chooseRememberedFolder", () => {
  it("mantém a pasta salva, escolhe a mais recente e respeita a remoção", () => {
    expect(
      chooseRememberedFolder({
        dismissed: false,
        configured: "/jogo/st_1",
        newestPath: "/jogo/st_2",
      }),
    ).toBe("/jogo/st_1");
    expect(
      chooseRememberedFolder({
        dismissed: false,
        configured: null,
        newestPath: "/jogo/st_2",
      }),
    ).toBe("/jogo/st_2");
    expect(
      chooseRememberedFolder({
        dismissed: true,
        configured: null,
        newestPath: "/jogo/st_2",
      }),
    ).toBeNull();
  });
});

describe("zenityDirectoryArgs", () => {
  it("abre o seletor na pasta inicial e trata cancelar", () => {
    expect(zenityDirectoryArgs("/home/ada")).toContain("--filename=/home/ada/");
    expect(zenityDirectoryArgs("/home/ada/")).toContain("--directory");
    expect(zenityDirectoryResult(0, "/home/ada/st_1\n")).toBe("/home/ada/st_1");
    expect(zenityDirectoryResult(1, "")).toBeNull();
    expect(() => zenityDirectoryResult(255, "")).toThrow(GameFolderError);
  });
});

describe("documentsDirectory", () => {
  it("lê Documentos do user-dirs e cai em ~/Documents", () => {
    expect(
      documentsDirectory("/home/ada", 'XDG_DOCUMENTS_DIR="$HOME/Docs"\n'),
    ).toBe("/home/ada/Docs");
    expect(documentsDirectory("/home/ada", null)).toBe("/home/ada/Documents");
  });
});

describe("saveFilePath", () => {
  it("aceita save.hg e recusa saída da pasta", () => {
    expect(saveFilePath("/jogo/st_1", "save4.hg")).toBe("/jogo/st_1/save4.hg");
    expect(() => saveFilePath("/jogo/st_1", "../save4.hg")).toThrow(GameFolderError);
    expect(() => saveFilePath("/jogo/st_1", "mf_save4.hg")).toThrow(GameFolderError);
    expect(isInside("/home/ada", "/home/ada/Docs")).toBe(true);
    expect(isInside("/home/ada", "/etc/passwd")).toBe(false);
  });
});

describe("isLocalRequest", () => {
  it("aceita localhost e recusa outra origem", () => {
    expect(isLocalRequest(new Request("http://localhost:3000/api/game-folder"))).toBe(true);
    expect(
      isLocalRequest(
        new Request("http://127.0.0.1:3000/api/game-folder", {
          headers: { origin: "http://127.0.0.1:3000" },
        }),
      ),
    ).toBe(true);
    expect(
      isLocalRequest(
        new Request("http://localhost:3000/api/game-folder", {
          headers: { origin: "https://example.com" },
        }),
      ),
    ).toBe(false);
  });
});

describe("discoverAt", () => {
  it("encontra a conta Steam com save.hg e ignora cache e mf_save", async () => {
    const home = await tempDir();
    const root = path.join(home, "NMS");
    const account = path.join(root, "st_76561198056936612");
    await fs.mkdir(path.join(account, "cache"), { recursive: true });
    await fs.writeFile(path.join(account, "save4.hg"), "auto");
    await fs.writeFile(path.join(account, "mf_save4.hg"), "meta");
    await fs.writeFile(path.join(account, "cache", "save.hg"), "nope");
    await fs.writeFile(path.join(root, "accountdata.hg"), "account");

    const folders = await discoverAt([root], home);
    expect(folders).toHaveLength(1);
    expect(folders[0]?.name).toBe("st_76561198056936612");
    expect(folders[0]?.storage).toBe("Steam");
  });
});

describe("writeSaveInPlace", () => {
  it("copia o arquivo atual para o backup e grava por cima do mesmo nome", async () => {
    const home = await tempDir();
    const saveDir = path.join(home, "st_1");
    const backupDir = path.join(home, "Documents", "NMS Archive");
    await fs.mkdir(saveDir, { recursive: true });
    await fs.writeFile(path.join(saveDir, "save4.hg"), "original");
    const now = new Date(2026, 8, 30, 15, 26, 7);

    const written = await writeSaveInPlace({
      saveDir,
      backupDir,
      name: "save4.hg",
      bytes: new Uint8Array([1, 2, 3]),
      now,
      expectedModified: Math.round((await fs.stat(path.join(saveDir, "save4.hg"))).mtimeMs),
    });

    expect(written.backupName).toBe("save4-2026-09-30-15-26-07.hg");
    expect(await fs.readFile(path.join(backupDir, written.backupName), "utf8")).toBe("original");
    expect(new Uint8Array(await fs.readFile(path.join(saveDir, "save4.hg")))).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("aceita a data do arquivo com 1 ms de diferença", async () => {
    const home = await tempDir();
    const saveDir = path.join(home, "st_1");
    await fs.mkdir(saveDir, { recursive: true });
    const target = path.join(saveDir, "save.hg");
    await fs.writeFile(target, "original");
    const mtime = Math.round((await fs.stat(target)).mtimeMs);
    await writeSaveInPlace({
      saveDir,
      backupDir: path.join(home, "backups"),
      name: "save.hg",
      bytes: new Uint8Array([4]),
      now: new Date(2026, 0, 2, 3, 4, 5),
      expectedModified: mtime - 1,
    });
    expect(new Uint8Array(await fs.readFile(target))).toEqual(new Uint8Array([4]));
  });

  it("recusa gravar se o arquivo mudou", async () => {
    const home = await tempDir();
    const saveDir = path.join(home, "st_1");
    await fs.mkdir(saveDir, { recursive: true });
    await fs.writeFile(path.join(saveDir, "save.hg"), "original");
    await expect(
      writeSaveInPlace({
        saveDir,
        backupDir: path.join(home, "backups"),
        name: "save.hg",
        bytes: new Uint8Array([9]),
        now: new Date(),
        expectedModified: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await fs.readFile(path.join(saveDir, "save.hg"), "utf8")).toBe("original");
  });
});
