"use client";

import { useState } from "react";
import { FolderOpen, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadBytes } from "@/lib/download";
import { fsErrorMessage } from "@/lib/nms/fs-access";
import {
  newestSave,
  saveKindLabel,
  storageFromFolderName,
  type SaveFileEntry,
  type SaveSlot,
} from "@/lib/nms/save-files";
import { entryFor, useSaveLocation } from "@/stores/save-location";
import { useSaveSession } from "@/stores/save-session";

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function formatModified(ms: number) {
  return new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileOptionLabel(file: SaveFileEntry, newestName: string | undefined) {
  const when = new Date(file.lastModified).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const recent = file.name === newestName ? " · mais recente" : "";
  return `${saveKindLabel(file.kind)} · ${file.name} · ${when}${recent}`;
}

async function run(action: () => Promise<void>) {
  try {
    await action();
  } catch (err) {
    toast.error(fsErrorMessage(err));
  }
}

export function SaveLocationPanel() {
  const supported = useSaveLocation((s) => s.supported);
  const hydrated = useSaveLocation((s) => s.hydrated);
  const saveFolderName = useSaveLocation((s) => s.saveFolderName);
  const saveFolderPath = useSaveLocation((s) => s.saveFolderPath);
  const localFolders = useSaveLocation((s) => s.localFolders);
  const savePermission = useSaveLocation((s) => s.savePermission);
  const backupFolderName = useSaveLocation((s) => s.backupFolderName);
  const scanning = useSaveLocation((s) => s.scanning);
  const writing = useSaveLocation((s) => s.writing);
  const slots = useSaveLocation((s) => s.slots);
  const summaries = useSaveLocation((s) => s.summaries);
  const selectedName = useSaveLocation((s) => s.selectedName);
  const boundName = useSaveLocation((s) => s.boundName);
  const diskStale = useSaveLocation((s) => s.diskStale);
  const locationError = useSaveLocation((s) => s.error);
  const resumeSaveFolder = useSaveLocation((s) => s.resumeSaveFolder);
  const selectLocalFolder = useSaveLocation((s) => s.selectLocalFolder);
  const reloadFromDisk = useSaveLocation((s) => s.reloadFromDisk);
  const selectSlot = useSaveLocation((s) => s.selectSlot);
  const selectFile = useSaveLocation((s) => s.selectFile);
  const saveInPlace = useSaveLocation((s) => s.saveInPlace);
  const status = useSaveSession((s) => s.status);
  const summary = useSaveSession((s) => s.summary);
  const origin = useSaveSession((s) => s.origin);
  const [confirmStale, setConfirmStale] = useState(false);
  const [customPath, setCustomPath] = useState("");

  const busy = scanning || writing || status === "loading" || !hydrated;
  const selected = entryFor(slots, selectedName);
  const slotNumber = selected?.slot ?? slots[0]?.slot;
  const files =
    slots.find((slot) => slot.slot === slotNumber)?.files ?? [];
  const newest = newestSave(files);
  const sameFolder =
    saveFolderName != null && saveFolderName === backupFolderName;
  const linked =
    boundName != null &&
    boundName === selectedName &&
    origin === "directory" &&
    (status === "ready" || status === "loading");

  function modeOf(name: string) {
    if (origin === "directory" && summary && name === boundName && !diskStale) {
      return summary.gameModeLabel;
    }
    return summaries[name]?.gameModeLabel;
  }

  function slotLabel(slot: SaveSlot) {
    const selectedMode =
      selected && slot.files.some((file) => file.name === selected.name)
        ? modeOf(selected.name)
        : undefined;
    const mode =
      selectedMode ??
      slot.files.map((file) => modeOf(file.name)).find(Boolean);
    return mode ? `Slot ${slot.slot} · ${mode}` : `Slot ${slot.slot}`;
  }

  async function onSave(force = false) {
    const result = await saveInPlace(force);
    if (result.status === "stale") {
      setConfirmStale(true);
      return;
    }
    if (result.status === "unbound") {
      toast.error(
        "Esse save não está ligado à pasta. Abra o arquivo de novo, ou baixe uma cópia.",
      );
      return;
    }
    if (result.status === "cancelled") return;
    if (result.status === "export") {
      downloadBytes(result.backupName, result.backupBytes);
      downloadBytes(result.fileName, result.bytes);
      toast.success(
        `Backup ${result.backupName} e o save ${result.fileName} foram baixados.`,
      );
      return;
    }
    toast.success(`Salvo em ${result.fileName}. Backup ${result.backupName}.`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pasta do jogo</CardTitle>
        <CardDescription>
          A pasta do jogo neste computador. Cada slot mostra o save do jogador
          e o automático, e o mais recente abre sozinho. Salvar grava nesse
          mesmo arquivo, depois de um backup com data e hora.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!hydrated ? (
          <p className="text-sm text-muted-foreground">Procurando a pasta do jogo…</p>
        ) : !supported ? (
          <p className="text-sm text-muted-foreground">
            Este navegador não deixa escolher uma pasta. Use Chromium, ou abra
            um save.hg avulso abaixo.
          </p>
        ) : !saveFolderName ? (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const next = customPath.trim();
              if (!next) return;
              void run(() => selectLocalFolder(next));
            }}
          >
            <p className="text-sm text-muted-foreground">
              Não achei saves do No Man&apos;s Sky neste computador. Cole o
              caminho da pasta da conta: no Steam ela se chama <code>st_</code>{" "}
              e o número, no GOG <code>DefaultUser</code>.
            </p>
            <input
              className={selectClass}
              value={customPath}
              placeholder="/caminho/da/pasta/st_…"
              aria-label="Caminho da pasta dos saves"
              onChange={(event) => setCustomPath(event.target.value)}
            />
            <Button type="submit" className="justify-self-start" disabled={!customPath.trim()}>
              <FolderOpen />
              Usar esta pasta
            </Button>
          </form>
        ) : savePermission !== "granted" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void run(() => resumeSaveFolder())}
            >
              <FolderOpen />
              Continuar com {saveFolderName}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {localFolders.length > 1 ? (
                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Conta</span>
                  <select
                    className={selectClass}
                    value={saveFolderPath ?? ""}
                    disabled={busy}
                    onChange={(event) => {
                      void run(() => selectLocalFolder(event.target.value));
                    }}
                  >
                    {localFolders.map((folder) => (
                      <option key={folder.path} value={folder.path}>
                        {folder.storage} · {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Origem</p>
                <p className="text-sm">{storageFromFolderName(saveFolderName)}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Pasta</p>
                <p
                  className="truncate font-mono text-sm"
                  title={saveFolderPath ?? saveFolderName}
                >
                  {saveFolderPath ?? saveFolderName}
                </p>
              </div>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Slot</span>
                <select
                  className={selectClass}
                  value={slotNumber != null ? String(slotNumber) : ""}
                  disabled={busy || slots.length === 0}
                  onChange={(event) => {
                    void run(() => selectSlot(Number(event.target.value)));
                  }}
                >
                  {slots.map((slot) => (
                    <option key={slot.slot} value={String(slot.slot)}>
                      {slotLabel(slot)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Arquivo</span>
                <select
                  className={selectClass}
                  value={selectedName ?? ""}
                  disabled={busy || files.length === 0}
                  onChange={(event) => {
                    void run(() => selectFile(event.target.value));
                  }}
                >
                  {files.map((file) => (
                    <option key={file.name} value={file.name}>
                      {fileOptionLabel(file, newest?.name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-1 text-sm text-muted-foreground">
              <p>
                Modificado{" "}
                <span className="text-foreground">
                  {selected ? formatModified(selected.lastModified) : "—"}
                </span>
              </p>
              <p>
                Backup em{" "}
                <span className="font-mono text-foreground">
                  {backupFolderName ?? "Documentos/NMS Archive"}
                </span>
              </p>
              {sameFolder ? (
                <p>
                  A pasta de backup tem o mesmo nome da pasta do jogo. Os
                  arquivos levam a data no nome e não entram na lista de slots.
                </p>
              ) : null}
            </div>

            {diskStale ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                Esse arquivo mudou no disco desde a última leitura. Recarregue,
                ou salve por cima — o backup leva a versão que está no disco
                agora.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || !selectedName}
                onClick={() => void run(() => reloadFromDisk())}
              >
                <RefreshCw />
                Recarregar
              </Button>
              {linked ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => onSave(false))}
                >
                  <Save />
                  {writing ? "Salvando…" : "Salvar neste arquivo"}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy || !selectedName}
                  onClick={() => {
                    if (!selectedName) return;
                    void run(() => selectFile(selectedName));
                  }}
                >
                  <FolderOpen />
                  Abrir este arquivo
                </Button>
              )}
            </div>
          </>
        )}

        {locationError ? (
          <p className="text-sm text-destructive">{locationError}</p>
        ) : null}
      </CardContent>

      <Dialog open={confirmStale} onOpenChange={setConfirmStale}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O arquivo no disco mudou</DialogTitle>
            <DialogDescription>
              Salvar substitui essa versão. O backup, com data e hora no nome,
              guarda o que está no disco agora.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStale(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setConfirmStale(false);
                void run(() => onSave(true));
              }}
            >
              Salvar por cima
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function SaveFolderSettings() {
  const hydrated = useSaveLocation((s) => s.hydrated);
  const saveFolderPath = useSaveLocation((s) => s.saveFolderPath);
  const localFolders = useSaveLocation((s) => s.localFolders);
  const backupFolderName = useSaveLocation((s) => s.backupFolderName);
  const selectLocalFolder = useSaveLocation((s) => s.selectLocalFolder);
  const [customPath, setCustomPath] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pasta do jogo</CardTitle>
        <CardDescription>
          O app neste computador abre e grava o save.hg. O backup fica em
          Documentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {!hydrated ? (
          <p className="text-muted-foreground">Procurando a pasta do jogo…</p>
        ) : (
          <>
            {localFolders.length > 1 ? (
              <label className="grid gap-1.5">
                <span className="text-muted-foreground">Conta</span>
                <select
                  className={selectClass}
                  value={saveFolderPath ?? ""}
                  onChange={(event) => {
                    void run(() => selectLocalFolder(event.target.value));
                  }}
                >
                  {localFolders.map((folder) => (
                    <option key={folder.path} value={folder.path}>
                      {folder.storage} · {folder.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>
                <span className="text-muted-foreground">Saves · </span>
                {saveFolderPath ? <code>{saveFolderPath}</code> : "nenhuma pasta ainda"}
              </p>
            )}
            {!saveFolderPath ? (
              <form
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = customPath.trim();
                  if (!next) return;
                  void run(() => selectLocalFolder(next));
                }}
              >
                <input
                  className={selectClass}
                  value={customPath}
                  placeholder="/caminho/da/pasta/st_…"
                  aria-label="Caminho da pasta dos saves"
                  onChange={(event) => setCustomPath(event.target.value)}
                />
                <Button type="submit" variant="outline" className="justify-self-start">
                  Usar esta pasta
                </Button>
              </form>
            ) : null}
            <p>
              <span className="text-muted-foreground">Backups · </span>
              {backupFolderName ? (
                <code>{backupFolderName}</code>
              ) : (
                "Documentos/NMS Archive"
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
