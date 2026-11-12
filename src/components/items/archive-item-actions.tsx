"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { archivedToNmsItem } from "@/lib/archive-export";
import { usesSlotPicker } from "@/lib/nms/extract/apply-depth";
import { gameVersionMismatch, type NmsItemFile } from "@/lib/nmsitem";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { trpc } from "@/lib/trpc";
import { getMappedJson, useSaveSession } from "@/stores/save-session";
import type { ArchivedItemSummary } from "@/types/archive";
import { ApplyToSaveDialog } from "./apply-to-save-dialog";
import { ExportMenu } from "./export-menu";
import { VersionMismatchDialog } from "./version-mismatch-dialog";

export function ArchiveItemActions({
  item,
  onDetails,
}: {
  item: ArchivedItemSummary;
  onDetails: () => void;
}) {
  const t = useTranslations("common");
  const utils = trpc.useUtils();
  const importItem = useSaveSession((s) => s.importItem);
  const saveReady = useSaveSession((s) => s.status === "ready");
  const [pending, setPending] = useState<NmsItemFile | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [choiceFile, setChoiceFile] = useState<NmsItemFile | null>(null);

  async function loadDetail() {
    return utils.items.get.fetch({ id: item.id });
  }

  async function commitApply(file: NmsItemFile) {
    try {
      const index = await importItem(file);
      toast.success(t("appliedSlot", { slot: index + 1 }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failApply"));
    } finally {
      setPending(null);
      setWarning(null);
    }
  }

  async function onApply() {
    try {
      const detail = await loadDetail();
      const file = archivedToNmsItem(detail);
      if (!file) return;
      if (!saveReady) {
        toast.error(t("openSaveToApply"));
        return;
      }
      if (usesSlotPicker(file.category)) {
        setChoiceFile(file);
        return;
      }
      const json = getMappedJson();
      const mismatch = json ? gameVersionMismatch(file, json) : null;
      if (mismatch) {
        setPending(file);
        setWarning(mismatch);
        return;
      }
      await commitApply(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failApply"));
    }
  }

  async function onDownload() {
    try {
      const detail = await loadDetail();
      const file = archivedToNmsItem(detail);
      if (!file) return;
      downloadNmsItemFile(file);
      toast.success(t("exportedNmsitem"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failExport"));
    }
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDetails}>
          {t("details")}
        </Button>
        <ExportMenu
          variant="archive"
          onApply={() => {
            void onApply();
          }}
          onDownload={() => {
            void onDownload();
          }}
        />
      </div>
      <VersionMismatchDialog
        open={pending != null}
        warning={warning}
        onCancel={() => {
          setPending(null);
          setWarning(null);
        }}
        onConfirm={() => {
          if (pending) void commitApply(pending);
        }}
      />
      <ApplyToSaveDialog
        open={choiceFile != null}
        onOpenChange={(next) => {
          if (!next) setChoiceFile(null);
        }}
        sourceFile={choiceFile}
      />
    </>
  );
}
