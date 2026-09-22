"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAdapter, type ExtractedSlot } from "@/lib/nms/extract";
import { saveSlotUiCategory } from "@/lib/archive-match";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { trpc } from "@/lib/trpc";
import { useSaveSession } from "@/stores/save-session";
import type { Category } from "@/types/nms";
import { ItemCompare } from "./item-compare";
import { JsonTree } from "./json-tree";

export function SaveItemDetailDialog({
  item,
  category,
  open,
  onOpenChange,
  onArchive,
}: {
  item: ExtractedSlot | null;
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: (item: ExtractedSlot) => void;
}) {
  const exportItem = useSaveSession((s) => s.exportItem);
  const clearSlot = useSaveSession((s) => s.clearSlot);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clearing, setClearing] = useState(false);
  const actionCategory = item?.category ?? category;
  const adapter = getAdapter(actionCategory);
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

  useEffect(() => {
    if (!open) setConfirmDelete(false);
  }, [open, item?.index, actionCategory]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item?.name ?? adapter.label}</DialogTitle>
          <DialogDescription>{bits.join(" · ")}</DialogDescription>
        </DialogHeader>
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
        {confirmDelete && item ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm">
              {item.category === "frigate"
                ? `Excluir ${item.name} deste save? Ela sai da frota. O arquivo pessoal não muda.`
                : `Excluir ${item.name} deste save? O slot fica vazio. O arquivo pessoal não muda.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => void onClear()}
                disabled={clearing}
              >
                {clearing ? "Excluindo…" : "Excluir do save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={clearing}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          {canClear ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={confirmDelete}
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
      </DialogContent>
    </Dialog>
  );
}
