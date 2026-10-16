"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isTypingTarget, neighborSlots } from "@/lib/item-nav";
import { getAdapter, type ExtractedSlot } from "@/lib/nms/extract";
import { saveSlotUiCategory } from "@/lib/archive-match";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { trpc } from "@/lib/trpc";
import { useSaveSession } from "@/stores/save-session";
import type { Category } from "@/types/nms";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ItemCompare } from "./item-compare";
import { ImportModelDialog } from "./import-model-dialog";
import { JsonTree } from "./json-tree";

export function SaveItemDetailDialog({
  item,
  category,
  open,
  onOpenChange,
  onArchive,
  navItems = [],
  onNavigate,
}: {
  item: ExtractedSlot | null;
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: (item: ExtractedSlot) => void;
  navItems?: ExtractedSlot[];
  onNavigate?: (item: ExtractedSlot) => void;
}) {
  const exportItem = useSaveSession((s) => s.exportItem);
  const clearSlot = useSaveSession((s) => s.clearSlot);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importModel, setImportModel] = useState(false);
  const actionCategory = item?.category ?? category;
  const adapter = getAdapter(actionCategory);
  const { prev, next } = neighborSlots(navItems, item);
  const slot = item?.slotLabel ?? (item ? String(item.index + 1) : "—");
  const bits = [
    `Slot ${slot}`,
    item?.className ? `Class ${item.className}` : null,
    item?.extra.element || null,
    item?.extra.biome ? `Biome ${item.extra.biome}` : null,
    item?.extra.level ? `Level ${item.extra.level}` : null,
    item?.itemType || null,
    item?.seed || null,
  ].filter(Boolean);
  const canImportModel =
    item != null &&
    !item.empty &&
    !item.readonly &&
    (actionCategory === "ship" ||
      actionCategory === "multitool" ||
      actionCategory === "freighter");
  const canClear =
    item != null &&
    !item.empty &&
    !item.readonly &&
    adapter.clear != null &&
    !(actionCategory === "freighter" && item.index === 0);
  const archived = trpc.items.list.useQuery(
    {
      category: item ? saveSlotUiCategory(item) : undefined,
      seed: item?.seed && item.seed !== "0x0" ? item.seed : undefined,
    },
    {
      enabled:
        open &&
        item != null &&
        !item.empty &&
        !item.readonly &&
        Boolean(item.seed) &&
        item.seed !== "0x0",
    },
  );
  const archivedHit = archived.data?.items[0];
  const archivedDetail = trpc.items.get.useQuery(
    { id: archivedHit?.id ?? "" },
    { enabled: open && archivedHit != null },
  );

  if (!open && (confirmDelete || importModel)) {
    setConfirmDelete(false);
    setImportModel(false);
  }

  useEffect(() => {
    if (!open || !onNavigate) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft" && prev) onNavigate(prev);
      if (event.key === "ArrowRight" && next) onNavigate(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onNavigate, prev, next]);

  async function onClear() {
    if (!item) return;
    setClearing(true);
    try {
      await clearSlot(item.category, item.index);
      toast.success("Excluído do save");
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir");
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && confirmDelete) {
          setConfirmDelete(false);
          return;
        }
        onOpenChange(next);
      }}
    >
        <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-start gap-2">
            {onNavigate ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="mt-[-2px] shrink-0"
                disabled={!prev}
                aria-label="Item anterior"
                onClick={() => prev && onNavigate(prev)}
              >
                <ChevronLeft />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <DialogTitle>
                Slot {slot}
                {item?.name && !item.empty ? ` · ${item.name}` : ""}
              </DialogTitle>
              <DialogDescription>{bits.join(" · ")}</DialogDescription>
            </div>
            {onNavigate ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="mt-[-2px] mr-6 shrink-0"
                disabled={!next}
                aria-label="Próximo item"
                onClick={() => next && onNavigate(next)}
              >
                <ChevronRight />
              </Button>
            ) : null}
          </div>
        </DialogHeader>
        <DialogBody className="grid gap-4">
        {item?.warning ? (
          <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            {item.warning}
          </p>
        ) : null}
        {item?.filename ? (
          <p className="font-mono text-xs break-all text-muted-foreground">
            Filename: {item.filename}
          </p>
        ) : null}
        {item && archivedDetail.data ? (
          <ItemCompare
            archived={{
              seed: archivedDetail.data.seed,
              className: archivedDetail.data.className,
              itemType: archivedDetail.data.shipType,
              payload: archivedDetail.data.payload,
            }}
            save={{
              seed: item.seed,
              className: item.className,
              itemType: item.itemType,
              payload: item.payload,
            }}
            saveLabel={`slot ${slot}`}
          />
        ) : null}
        {item ? <JsonTree value={item.payload} /> : null}
        </DialogBody>
        <DialogFooter>
          {canClear ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
            >
              Excluir
            </Button>
          ) : null}
          {item && !item.readonly && !item.empty ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onArchive?.(item);
              }}
            >
              Arquivar
            </Button>
          ) : null}
          {canImportModel ? (
            <Button type="button" variant="outline" onClick={() => setImportModel(true)}>
              Importar modelo
            </Button>
          ) : null}
          {item && !item.readonly && !item.empty ? (
            <Button
              type="button"
              onClick={() => {
                try {
                  downloadNmsItemFile(
                    exportItem(item.category, item.index),
                  );
                  toast.success("Exportado .nmsitem");
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Falha no export",
                  );
                }
              }}
            >
              Exportar .nmsitem
            </Button>
          ) : null}
        </DialogFooter>
          <ConfirmDeleteDialog
            open={confirmDelete && item != null}
            title={item ? `Excluir ${item.name}?` : "Excluir item?"}
            description={
              item?.category === "frigate"
                ? "Ela sai da frota. O arquivo pessoal não muda."
                : "O slot fica vazio. O arquivo pessoal não muda."
            }
            confirmLabel="Excluir do save"
            pending={clearing}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => void onClear()}
          />
      </DialogContent>
      <ImportModelDialog
        item={canImportModel ? item : null}
        open={importModel && canImportModel}
        onOpenChange={setImportModel}
      />
    </Dialog>
    </>
  );
}
