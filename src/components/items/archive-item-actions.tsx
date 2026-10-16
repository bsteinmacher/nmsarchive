"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { archivedToNmsItem } from "@/lib/archive-export";
import { gameVersionMismatch, type NmsItemFile } from "@/lib/nmsitem";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { trpc } from "@/lib/trpc";
import { getMappedJson, useSaveSession } from "@/stores/save-session";
import type { ArchivedItemSummary } from "@/types/archive";
import { ExportMenu } from "./export-menu";
import { VersionMismatchDialog } from "./version-mismatch-dialog";

export function ArchiveItemActions({
  item,
  onDetails,
}: {
  item: ArchivedItemSummary;
  onDetails: () => void;
}) {
  const utils = trpc.useUtils();
  const importItem = useSaveSession((s) => s.importItem);
  const saveReady = useSaveSession((s) => s.status === "ready");
  const [pending, setPending] = useState<NmsItemFile | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function loadDetail() {
    return utils.items.get.fetch({ id: item.id });
  }

  async function applyFile(file: NmsItemFile) {
    try {
      const index = await importItem(file);
      toast.success(`Aplicado no slot ${index + 1} do save aberto.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao aplicar");
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
        toast.error("Abra um save para aplicar este item num slot.");
        return;
      }
      const json = getMappedJson();
      const mismatch = json ? gameVersionMismatch(file, json) : null;
      if (mismatch) {
        setPending(file);
        setWarning(mismatch);
        return;
      }
      await applyFile(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao aplicar");
    }
  }

  async function onDownload() {
    try {
      const detail = await loadDetail();
      const file = archivedToNmsItem(detail);
      if (!file) return;
      downloadNmsItemFile(file);
      toast.success("Exportado .nmsitem");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no export");
    }
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDetails}>
          Ver detalhes
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
          if (pending) void applyFile(pending);
        }}
      />
    </>
  );
}
