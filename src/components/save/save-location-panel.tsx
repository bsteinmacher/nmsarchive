"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMediumDateTime, useShortDateTime } from "@/i18n/format";
import { FolderOpen, RefreshCw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { CollapsibleCard } from "@/components/layout/collapsible-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fsErrorMessage } from "@/lib/nms/fs-access";
import { reportSaveInPlace, useSaveReportCopy } from "@/components/save/save-in-place";
import {
  newestSave,
  storageFromFolderName,
  type SaveFileEntry,
  type SaveSlot,
} from "@/lib/nms/save-files";
import { entryFor, useSaveLocation } from "@/stores/save-location";
import { useSaveSession } from "@/stores/save-session";

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function code(chunks: ReactNode) {
  return <code>{chunks}</code>;
}

async function run(action: () => Promise<void>) {
  try {
    await action();
  } catch (err) {
    toast.error(fsErrorMessage(err));
  }
}

function UnselectedFolder() {
  const t = useTranslations("save");
  const selectLocalFolder = useSaveLocation((s) => s.selectLocalFolder);
  const [customPath, setCustomPath] = useState("");
  const [picking, setPicking] = useState(false);

  async function chooseFromDialog() {
    setPicking(true);
    try {
      const res = await fetch("/api/game-folder/pick", { method: "POST" });
      const body = (await res.json()) as { path?: string; cancelled?: boolean; error?: string };
      if (!res.ok) throw new Error(body.error ?? t("pickerFailed"));
      if (body.cancelled || !body.path) return;
      await selectLocalFolder(body.path);
    } finally {
      setPicking(false);
    }
  }

  return (
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
        {t.rich("folderHint", { code })}
      </p>
      <Button
        type="button"
        className="justify-self-start"
        disabled={picking}
        onClick={() => void run(chooseFromDialog)}
      >
        <FolderOpen />
        {picking ? t("choosing") : t("chooseFolder")}
      </Button>
      <div className="flex items-center gap-2">
        <input
          className={`${selectClass} flex-1`}
          value={customPath}
          placeholder={t("pathPlaceholder")}
          aria-label={t("pathLabel")}
          onChange={(event) => setCustomPath(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!customPath.trim() || picking}>
          {t("usePath")}
        </Button>
      </div>
    </form>
  );
}

export function SaveLocationPanel({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("save");
  const common = useTranslations("common");
  const formatModified = useMediumDateTime();
  const formatShort = useShortDateTime();
  const reportCopy = useSaveReportCopy();
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
  const clearLocalFolder = useSaveLocation((s) => s.clearLocalFolder);
  const reloadFromDisk = useSaveLocation((s) => s.reloadFromDisk);
  const selectSlot = useSaveLocation((s) => s.selectSlot);
  const selectFile = useSaveLocation((s) => s.selectFile);
  const saveInPlace = useSaveLocation((s) => s.saveInPlace);
  const status = useSaveSession((s) => s.status);
  const summary = useSaveSession((s) => s.summary);
  const origin = useSaveSession((s) => s.origin);
  const [confirmStale, setConfirmStale] = useState(false);

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
    return mode
      ? t("slotOption", { slot: slot.slot, mode })
      : t("slotOnly", { slot: slot.slot });
  }

  async function onSave(force = false) {
    const result = await saveInPlace(force);
    await reportSaveInPlace(result, () => setConfirmStale(true), reportCopy);
  }

  return (
    <>
    <CollapsibleCard
      title={t("folderTitle")}
      description={t("folderDescription")}
      expandLabel={t("folderExpand")}
      collapseLabel={t("folderCollapse")}
      expanded={expanded}
      onExpandedChange={() => onToggle()}
      contentClassName="grid gap-4"
    >
        {!hydrated ? (
          <p className="text-sm text-muted-foreground">{t("searchingFolder")}</p>
        ) : !supported ? (
          <p className="text-sm text-muted-foreground">{t("browserNoFolder")}</p>
        ) : !saveFolderName ? (
          <UnselectedFolder />
        ) : savePermission !== "granted" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void run(() => resumeSaveFolder())}
            >
              <FolderOpen />
              {t("continueWith", { name: saveFolderName })}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {localFolders.length > 1 ? (
                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">{t("account")}</span>
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
                <p className="text-xs text-muted-foreground">{t("origin")}</p>
                <p className="text-sm">{storageFromFolderName(saveFolderName)}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">{t("folder")}</p>
                <div className="flex min-w-0 items-center gap-1">
                  <p
                    className="min-w-0 flex-1 truncate font-mono text-sm"
                    title={saveFolderPath ?? saveFolderName}
                  >
                    {saveFolderPath ?? saveFolderName}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    className="shrink-0 rounded-full"
                    aria-label={t("removeFolder")}
                    disabled={busy}
                    onClick={() => void run(() => clearLocalFolder())}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs text-muted-foreground">{t("slot")}</span>
                <select
                  className={selectClass}
                  value={slotNumber != null ? String(slotNumber) : ""}
                  disabled={busy || slots.length === 0}
                  onChange={(event) => {
                    void run(() => selectSlot(Number(event.target.value)));
                  }}
                >
                  {slots.length === 0 ? <option value="">{common("none")}</option> : null}
                  {slots.map((slot) => (
                    <option key={slot.slot} value={String(slot.slot)}>
                      {slotLabel(slot)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs text-muted-foreground">{t("file")}</span>
                <select
                  className={selectClass}
                  value={selectedName ?? ""}
                  disabled={busy || files.length === 0}
                  onChange={(event) => {
                    void run(() => selectFile(event.target.value));
                  }}
                >
                  {files.length === 0 ? <option value="">{common("none")}</option> : null}
                  {files.map((file) => {
                    const when = formatShort(file.lastModified);
                    const kind = file.kind === "auto" ? t("autoSave") : t("playerSave");
                    const recent = file.name === newest?.name ? t("mostRecent") : "";
                    return (
                    <option key={file.name} value={file.name}>
                      {`${kind} · ${file.name} · ${when}${recent}`}
                    </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <div className="grid gap-1 text-sm text-muted-foreground">
              <p>
                {t("modified")}{" "}
                <span className="text-foreground">
                  {selected ? formatModified(selected.lastModified) : "—"}
                </span>
              </p>
              <p>
                {t("backupIn")}{" "}
                <span className="font-mono text-foreground">
                  {backupFolderName ?? t("defaultBackup")}
                </span>
              </p>
              {sameFolder ? (
                <p>
                  {t("sameBackupName")}
                </p>
              ) : null}
            </div>

            {diskStale ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                {t("diskStale")}
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
                {t("reload")}
              </Button>
              {linked ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => onSave(false))}
                >
                  <Save />
                  {writing ? common("saving") : t("saveHere")}
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
                  {t("openThisFile")}
                </Button>
              )}
            </div>
          </>
        )}

        {locationError ? (
          <p className="text-sm text-destructive">{locationError}</p>
        ) : null}
    </CollapsibleCard>

      <Dialog open={confirmStale} onOpenChange={setConfirmStale}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("diskChangedSaveTitle")}</DialogTitle>
            <DialogDescription>{t("diskChangedSaveBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStale(false)}>
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                setConfirmStale(false);
                void run(() => onSave(true));
              }}
            >
              {t("overwrite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SaveFolderSettings() {
  const t = useTranslations("save");
  const hydrated = useSaveLocation((s) => s.hydrated);
  const saveFolderPath = useSaveLocation((s) => s.saveFolderPath);
  const backupFolderName = useSaveLocation((s) => s.backupFolderName);
  const clearLocalFolder = useSaveLocation((s) => s.clearLocalFolder);

  return (
    <CollapsibleCard
      title={t("folderTitle")}
      description={t("folderSettingsDescription")}
      expandLabel={t("folderExpand")}
      collapseLabel={t("folderCollapse")}
      contentClassName="grid gap-3 text-sm"
    >
        {!hydrated ? (
          <p className="text-muted-foreground">{t("searchingFolder")}</p>
        ) : !saveFolderPath ? (
          <UnselectedFolder />
        ) : (
          <p className="flex min-w-0 items-center gap-1">
            <span className="text-muted-foreground">{t("savesLabel")}</span>
            <code className="min-w-0 flex-1 truncate">{saveFolderPath}</code>
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              className="shrink-0 rounded-full"
              aria-label={t("removeFolder")}
              onClick={() => void run(() => clearLocalFolder())}
            >
              <X />
            </Button>
          </p>
        )}
        <p>
          <span className="text-muted-foreground">{t("backupsLabel")}</span>
          {backupFolderName ? (
            <code>{backupFolderName}</code>
          ) : (
            t("defaultBackup")
          )}
        </p>
    </CollapsibleCard>
  );
}
