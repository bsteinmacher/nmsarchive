"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { gameTermLabel } from "@/i18n/game-terms";
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
  const t = useTranslations("archive");
  const common = useTranslations("common");
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
    `${common("slot")} ${slot}`,
    item?.category === "squadron"
      ? item.className
        ? common("rankValue", { value: item.className })
        : null
      : item?.className
        ? common("classValue", { value: item.className })
        : null,
    item?.extra.race || null,
    item?.extra.unlocked === "true"
      ? t("unlocked")
      : item?.extra.unlocked === "false"
        ? t("locked")
        : null,
    item?.extra.element || null,
    item?.extra.biome ? common("biomeValue", { value: item.extra.biome }) : null,
    item?.extra.level ? `${t("columns.level")} ${item.extra.level}` : null,
    item?.itemType ? gameTermLabel(item.itemType) : null,
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
      if (event.key === "ArrowLeft" && prev) onNavigate?.(prev);
      if (event.key === "ArrowRight" && next) onNavigate?.(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onNavigate, prev, next]);

  async function onClear() {
    if (!item) return;
    setClearing(true);
    try {
      await clearSlot(item.category, item.index);
      toast.success(common("deletedFromSave"));
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : common("failDelete"));
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
                aria-label={common("previousItem")}
                onClick={() => prev && onNavigate(prev)}
              >
                <ChevronLeft />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <DialogTitle>
                {common("slotTitle", { slot })}
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
                aria-label={common("nextItem")}
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
            {common("filename", { name: item.filename })}
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
            saveLabel={t("slotRef", { slot })}
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
              {common("delete")}
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
              {common("archive")}
            </Button>
          ) : null}
          {canImportModel ? (
            <Button type="button" variant="outline" onClick={() => setImportModel(true)}>
              {t("importModel")}
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
                  toast.success(common("exportedNmsitem"));
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : common("failExport"),
                  );
                }
              }}
            >
              {common("exportNmsitem")}
            </Button>
          ) : null}
        </DialogFooter>
          <ConfirmDeleteDialog
            open={confirmDelete && item != null}
            title={
              item
                ? common("excludeNamed", { name: item.name })
                : common("excludeItem")
            }
            description={
              item?.category === "frigate"
                ? t("frigateDelete")
                : item?.category === "squadron"
                  ? t("squadronDelete")
                  : t("slotDelete")
            }
            confirmLabel={common("excludeFromSave")}
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
