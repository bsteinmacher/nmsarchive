"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useIntegerFormat } from "@/i18n/format";
import { Download, FileJson, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadBytes } from "@/lib/download";
import { trpc } from "@/lib/trpc";
import { formatPlayTime } from "@/lib/nms/player";
import { usesSlotPicker } from "@/lib/nms/extract/apply-depth";
import { gameVersionMismatch, parseNmsItem, type NmsItemFile } from "@/lib/nmsitem";
import { ApplyToSaveDialog } from "@/components/items/apply-to-save-dialog";
import { CollapsibleCard } from "@/components/layout/collapsible-card";
import { downloadNmsItemZip } from "@/lib/nmsitem-zip";
import { getMappedJson, useSaveSession } from "@/stores/save-session";
import { pushSessionActivity } from "@/stores/session-activity";
import { CurrencyEditDialog, type CurrencyField } from "./currencies-dialog";
import { SaveContextSwitch } from "./save-context-switch";
import { SaveLocationPanel } from "./save-location-panel";
import { UploadDropzone } from "./upload-dropzone";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function CurrencyStat({
  label,
  value,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={editLabel}
          className="text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" className="size-3" />
        </Button>
      </div>
      <p className="font-heading text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function code(chunks: ReactNode) {
  return <code>{chunks}</code>;
}

export function SaveDashboard() {
  const t = useTranslations("save");
  const common = useTranslations("common");
  const settings = useTranslations("settings");
  const archive = useTranslations("archive");
  const formatInteger = useIntegerFormat();
  const status = useSaveSession((s) => s.status);
  const summary = useSaveSession((s) => s.summary);
  const fileName = useSaveSession((s) => s.fileName);
  const mappingVersion = useSaveSession((s) => s.mappingVersion);
  const unknownKeys = useSaveSession((s) => s.unknownKeys);
  const error = useSaveSession((s) => s.error);
  const clear = useSaveSession((s) => s.clear);
  const importItem = useSaveSession((s) => s.importItem);
  const exportAllShips = useSaveSession((s) => s.exportAllShips);
  const expeditionAvailable = useSaveSession((s) => s.expeditionAvailable);
  const downloadRewritten = useSaveSession((s) => s.downloadRewritten);
  const downloadOriginal = useSaveSession((s) => s.downloadOriginal);
  const dirty = useSaveSession((s) => s.dirty);
  const reparseOpenSave = useSaveSession((s) => s.reparseOpenSave);
  const utils = trpc.useUtils();
  const mappingAvailability = trpc.settings.mappingAvailability.useQuery(
    undefined,
    {
      enabled: unknownKeys.length > 0,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  );
  const updateMapping = trpc.settings.updateMapping.useMutation();
  const newerMapping = mappingAvailability.data?.updateAvailable === true;
  const importRef = useRef<HTMLInputElement>(null);
  const [pendingItem, setPendingItem] = useState<NmsItemFile | null>(null);
  const [versionWarning, setVersionWarning] = useState<string | null>(null);
  const [choiceFile, setChoiceFile] = useState<NmsItemFile | null>(null);
  const [editingCurrency, setEditingCurrency] = useState<CurrencyField | null>(
    null,
  );
  const [sourcePanel, setSourcePanel] = useState<null | "folder" | "loose">(
    null,
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function toggleSource(panel: "folder" | "loose") {
    setSourcePanel((current) => (current === panel ? null : panel));
  }

  async function closeSave() {
    setConfirmDiscard(false);
    if (dirty) {
      pushSessionActivity("cancel", {
        fileName,
        saveName: summary?.saveName,
      });
    }
    await clear();
    toast.message(t("sessionEnded"));
  }

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    void closeSave();
  }

  async function commitImport(item: NmsItemFile) {
    try {
      const index = await importItem(item);
      toast.success(common("importedSlot", { slot: index + 1 }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : common("failImport"));
    } finally {
      setPendingItem(null);
      setVersionWarning(null);
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    let item: NmsItemFile;
    try {
      item = parseNmsItem(await file.text());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : common("invalidFile"));
      return;
    }
    if (usesSlotPicker(item.category)) {
      setChoiceFile(item);
      return;
    }
    const json = getMappedJson();
    const warning = json ? gameVersionMismatch(item, json) : null;
    if (warning) {
      setPendingItem(item);
      setVersionWarning(warning);
      return;
    }
    try {
      const index = await importItem(item);
      toast.success(common("importedSlot", { slot: index + 1 }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : common("failImport"));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {status === "ready" && summary ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{summary.saveName || fileName || t("fallbackName")}</CardTitle>
            <CardDescription>
              {summary.saveSummary || t("noSummary")} ·{" "}
              {t("mapping", { version: mappingVersion ?? "" })}
            </CardDescription>
            {expeditionAvailable ? (
              <CardAction>
                <SaveContextSwitch />
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label={t("galaxy")} value={summary.galaxyLabel} />
            <Stat label={t("playTime")} value={formatPlayTime(summary.playTimeSec)} />
            <Stat label={t("mode")} value={summary.gameModeLabel} />
            <div className="col-span-full grid gap-3 sm:grid-cols-3">
              <CurrencyStat
                label={t("units")}
                value={formatInteger(summary.units)}
                editLabel={t("editCurrency", { label: t("units") })}
                onEdit={() => setEditingCurrency("units")}
              />
              <CurrencyStat
                label={t("nanites")}
                value={formatInteger(summary.nanites)}
                editLabel={t("editCurrency", { label: t("nanites") })}
                onEdit={() => setEditingCurrency("nanites")}
              />
              <CurrencyStat
                label={t("quicksilver")}
                value={formatInteger(summary.specials)}
                editLabel={t("editCurrency", { label: t("quicksilver") })}
                onEdit={() => setEditingCurrency("specials")}
              />
            </div>
            <Stat
              label={t("ships")}
              value={`${summary.shipCount} / ${summary.shipSlots}`}
            />
            <Stat label={t("platform")} value={summary.platform || "—"} />
            <Stat label={t("version")} value={String(summary.gameVersion)} />
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                try {
                  const items = exportAllShips();
                  if (items.length === 0) {
                    toast.error(t("noFilledShips"));
                    return;
                  }
                  downloadNmsItemZip("ships.nmsitem.zip", items);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : common("failExport"),
                  );
                }
              }}
            >
              <FileJson />
              {t("exportAll")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => importRef.current?.click()}
            >
              {t("importNmsitem")}
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".nmsitem,.json,application/json"
              className="hidden"
              onChange={(e) => {
                void onImportFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              className="sm:ml-auto"
              onClick={requestClose}
            >
              <Trash2 />
              {t("closeSave")}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {status === "hydrating" || status === "loading"
                ? t("loadingSave")
                : t("noSave")}
            </CardTitle>
            <CardDescription>{t("noSaveHint")}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {unknownKeys.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("unknownKeys")}</CardTitle>
            <CardDescription>
              {newerMapping
                ? t("newerMapping", {
                    remote: mappingAvailability.data?.remoteVersion ?? "",
                    local: mappingAvailability.data?.localVersion ?? "",
                  })
                : t("uncoveredKeys", { count: unknownKeys.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-xs">
            {unknownKeys.join(", ")}
          </CardContent>
          {newerMapping ? (
            <CardFooter>
              <Button
                type="button"
                variant="outline"
                disabled={updateMapping.isPending}
                onClick={() => {
                  void (async () => {
                    try {
                      const result = await updateMapping.mutateAsync();
                      let reparsed = false;
                      try {
                        reparsed = await reparseOpenSave();
                      } catch {
                        reparsed = false;
                      }
                      toast.success(
                        reparsed
                          ? t("mappingReparsed", { version: result.libMBIN_version })
                          : settings("mappingUpdated", { version: result.libMBIN_version }),
                      );
                      await Promise.all([
                        utils.settings.get.invalidate(),
                        utils.logs.list.invalidate(),
                        utils.settings.mappingAvailability.invalidate(),
                      ]);
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : settings("mappingFailed"),
                      );
                    }
                  })();
                }}
              >
                {updateMapping.isPending ? settings("downloading") : settings("updateMapping")}
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      ) : null}

      <SaveLocationPanel
        expanded={sourcePanel === "folder"}
        onToggle={() => toggleSource("folder")}
      />

      <CollapsibleCard
        title={t("looseTitle")}
        description={t.rich("looseDescription", { code })}
        expandLabel={t("looseExpand")}
        collapseLabel={t("looseCollapse")}
        expanded={sourcePanel === "loose"}
        onExpandedChange={() => toggleSource("loose")}
        contentClassName="space-y-3"
      >
        <UploadDropzone />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {status === "ready" && summary ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <Download />
              {t("downloadCopy")}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  void (async () => {
                    try {
                      const bytes = await downloadRewritten();
                      const name = (fileName ?? "save.hg").replace(
                        /(\.hg)?$/i,
                        "-edited.hg",
                      );
                      downloadBytes(name, bytes);
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : common("failRecompress"),
                      );
                    }
                  })();
                }}
              >
                {t("editedFile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    downloadBytes(fileName ?? "save.hg", downloadOriginal());
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : common("noOriginal"),
                    );
                  }
                }}
              >
                {t("originalFile")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </CollapsibleCard>

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("unsavedTitle")}</DialogTitle>
            <DialogDescription>{t("unsavedBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => void closeSave()}>
              {t("closeAnyway")}
            </Button>
            <Button onClick={() => setConfirmDiscard(false)}>{common("back")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplyToSaveDialog
        open={choiceFile != null}
        onOpenChange={(next) => {
          if (!next) setChoiceFile(null);
        }}
        sourceFile={choiceFile}
      />

      <CurrencyEditDialog
        field={editingCurrency}
        onClose={() => setEditingCurrency(null)}
      />

      <Dialog
        open={pendingItem != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingItem(null);
            setVersionWarning(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{archive("versionTitle")}</DialogTitle>
            <DialogDescription>
              {archive("versionImport", { warning: versionWarning ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingItem(null);
                setVersionWarning(null);
              }}
            >
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                if (pendingItem) void commitImport(pendingItem);
              }}
            >
              {archive("importAnyway")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
