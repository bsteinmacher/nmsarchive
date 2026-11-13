"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CollapsibleCard } from "@/components/layout/collapsible-card";
import { LocaleSelect } from "@/components/settings/locale-select";
import { useShortDateTime } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SaveFolderSettings } from "@/components/save/save-location-panel";
import { TagsPanel } from "@/components/settings/tags-panel";
import { formatOperationLabel, logSubject } from "@/lib/operation-labels";
import { trpc } from "@/lib/trpc";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MiB`;
}

function code(chunks: ReactNode) {
  return <code>{chunks}</code>;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const formatWhen = useShortDateTime();
  const utils = trpc.useUtils();
  const settings = trpc.settings.get.useQuery();
  const logs = trpc.logs.list.useQuery({ limit: 40 });
  const backup = trpc.settings.backup.useMutation();
  const restore = trpc.settings.restore.useMutation();
  const restoreUpload = trpc.settings.restoreUpload.useMutation();
  const updateMapping = trpc.settings.updateMapping.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function refreshAll() {
    await Promise.all([
      utils.settings.get.invalidate(),
      utils.logs.list.invalidate(),
    ]);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <LocaleSelect />

      <SaveFolderSettings />

      <TagsPanel />

      <CollapsibleCard
        title={t("databaseTitle")}
        description={t("databaseDescription")}
        expandLabel={t("databaseExpand")}
        collapseLabel={t("databaseCollapse")}
        contentClassName="grid gap-2 text-sm"
      >
        <p>
          <span className="text-muted-foreground">DATABASE_URL · </span>
          <code>{settings.data?.databaseUrl ?? "…"}</code>
        </p>
        <p>
          <span className="text-muted-foreground">{t("databaseFile")}</span>
          <code className="break-all">
            {settings.data?.databasePath ?? "…"}
          </code>
          {settings.data?.databaseSize != null
            ? ` · ${formatBytes(settings.data.databaseSize)}`
            : null}
        </p>
      </CollapsibleCard>

      <CollapsibleCard
        title={t("backupTitle")}
        description={t.rich("backupDescription", { code })}
        expandLabel={t("backupExpand")}
        collapseLabel={t("backupCollapse")}
        contentClassName="grid gap-4"
      >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                void (async () => {
                  try {
                    const result = await backup.mutateAsync();
                    toast.success(
                      t("backupToast", { fileName: result.fileName ?? "" }),
                    );
                    await refreshAll();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : t("backupFailed"),
                    );
                  }
                })();
              }}
              disabled={backup.isPending}
            >
              {backup.isPending ? t("copying") : t("backupNow")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={restoreUpload.isPending || busy}
            >
              {t("restoreDb")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".db,application/octet-stream"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void (async () => {
                  setBusy(true);
                  try {
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    await restoreUpload.mutateAsync({
                      bytes,
                      fileName: file.name,
                    });
                    toast.success(
                      t("restoredReload"),
                    );
                    window.location.reload();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : t("restoreFailed"),
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </div>
          {settings.data?.backups.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("file")}</TableHead>
                  <TableHead>{t("size")}</TableHead>
                  <TableHead>{t("when")}</TableHead>
                  <TableHead className="text-right">{common("action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.data.backups.map((row) => (
                  <TableRow key={row.fileName}>
                    <TableCell className="font-mono text-xs">
                      {row.fileName}
                    </TableCell>
                    <TableCell>{formatBytes(row.size)}</TableCell>
                    <TableCell>{formatWhen(row.mtime)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            try {
                              await restore.mutateAsync({
                                fileName: row.fileName,
                              });
                              toast.success(
                                t("restoredFile", { fileName: row.fileName }),
                              );
                              window.location.reload();
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : t("restoreFailed"),
                              );
                            }
                          })();
                        }}
                        disabled={restore.isPending}
                      >
                        {t("restore")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("noBackups")}
            </p>
          )}
      </CollapsibleCard>

      <CollapsibleCard
        title={t("mappingTitle")}
        description={t.rich("mappingDescription", { code })}
        expandLabel={t("mappingExpand")}
        collapseLabel={t("mappingCollapse")}
        contentClassName="flex flex-wrap items-center gap-3"
      >
        <p className="text-sm text-muted-foreground">
          {t("mappingLib", {
            version: settings.data?.mappingVersion ?? t("mappingLoading"),
          })}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void (async () => {
              try {
                const result = await updateMapping.mutateAsync();
                toast.success(
                  t("mappingUpdated", { version: result.libMBIN_version }),
                );
                await refreshAll();
              } catch (err) {
                toast.error(
                  err instanceof Error
                    ? err.message
                    : t("mappingFailed"),
                );
              }
            })();
          }}
          disabled={updateMapping.isPending}
        >
          {updateMapping.isPending ? t("downloading") : t("updateMapping")}
        </Button>
      </CollapsibleCard>

      <CollapsibleCard
        title={t("logTitle")}
        description={t("logDescription")}
        expandLabel={t("logExpand")}
        collapseLabel={t("logCollapse")}
      >
          {logs.isLoading ? (
            <p className="text-sm text-muted-foreground">{common("loading")}</p>
          ) : !logs.data?.length ? (
            <p className="text-sm text-muted-foreground">
              {t("noOperations")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{common("action")}</TableHead>
                  <TableHead>{t("item")}</TableHead>
                  <TableHead>{t("when")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {formatOperationLabel(row.action, (key) =>
                        t.has(`operations.${key}`)
                          ? t(`operations.${key}`)
                          : undefined,
                      )}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {logSubject(row) ?? "—"}
                    </TableCell>
                    <TableCell>{formatWhen(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </CollapsibleCard>
    </div>
  );
}
