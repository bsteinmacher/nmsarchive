"use client";

import { GripVertical } from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdapter, type AdapterColumn, type ExtractedSlot } from "@/lib/nms/extract";
import type { Category } from "@/types/nms";

function dash(value: string) {
  return value || "—";
}

export function columnValue(item: ExtractedSlot, col: AdapterColumn): string {
  if (col.id === "className") return item.className;
  if (col.id === "itemType") return item.itemType;
  if (col.id === "seed") return item.seed;
  return item.extra[col.id] ?? "";
}

export function SaveSlotActions({
  item,
  onSelect,
  onArchive,
  onExport,
}: {
  item: ExtractedSlot;
  onSelect: (item: ExtractedSlot) => void;
  onArchive: (item: ExtractedSlot) => void;
  onExport: (item: ExtractedSlot) => void;
}) {
  const canAct = !item.empty && !item.readonly;
  if (canAct) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onSelect(item)}>
          Ver detalhes
        </Button>
        <Button size="sm" variant="outline" onClick={() => onArchive(item)}>
          Arquivar
        </Button>
        <Button size="sm" variant="outline" onClick={() => onExport(item)}>
          Exportar
        </Button>
      </div>
    );
  }
  if (item.readonly) {
    return (
      <Button size="sm" variant="ghost" onClick={() => onSelect(item)}>
        Ver detalhes
      </Button>
    );
  }
  return null;
}

export function SaveSlotGrid({
  category,
  items,
  reorderable,
  columns,
  caption,
  description,
  emptyMessage,
  dragging,
  over,
  screenshotUrl,
  onDragOver,
  onDrop,
  onDragLeave,
  onDragStart,
  onDragEnd,
  onSelect,
  onArchive,
  onExport,
}: {
  category: Category;
  items: ExtractedSlot[];
  reorderable: boolean;
  columns: readonly AdapterColumn[];
  caption: string;
  description: string;
  emptyMessage?: string;
  dragging: number | null;
  over: number | null;
  screenshotUrl: (item: ExtractedSlot) => string | null;
  onDragOver: (index: number) => void;
  onDrop: (from: number, to: number) => void;
  onDragLeave: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  onSelect: (item: ExtractedSlot) => void;
  onArchive: (item: ExtractedSlot) => void;
  onExport: (item: ExtractedSlot) => void;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{caption}</CardTitle>
          <CardDescription>
            {emptyMessage ?? getAdapter(category).missingMessage}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const previewCols = columns.filter((col) => col.id !== "seed").slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{caption}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const slot = item.slotLabel ?? String(item.index + 1);
            const isOver = over === item.index && dragging !== item.index;
            const thumb = screenshotUrl(item);
            const meta = previewCols
              .map((col) => {
                const value = columnValue(item, col);
                return value ? `${col.header} ${value}` : null;
              })
              .filter(Boolean);
            return (
              <li key={`${item.group ?? "primary"}-${item.index}`}>
                <article
                  onDragOver={
                    reorderable
                      ? (e) => {
                          e.preventDefault();
                          onDragOver(item.index);
                        }
                      : undefined
                  }
                  onDrop={
                    reorderable
                      ? (e) => {
                          e.preventDefault();
                          const from = Number(
                            e.dataTransfer.getData("text/plain"),
                          );
                          onDragEnd();
                          if (Number.isInteger(from)) onDrop(from, item.index);
                        }
                      : undefined
                  }
                  onDragLeave={
                    reorderable
                      ? () => onDragLeave(item.index)
                      : undefined
                  }
                  className={cn(
                    "relative flex h-full min-h-11 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
                    (item.empty || item.readonly) && "text-muted-foreground",
                    isOver && "bg-muted",
                    dragging === item.index && "opacity-60",
                  )}
                >
                  {reorderable ? (
                    <button
                      type="button"
                      draggable
                      tabIndex={-1}
                      aria-label={`Reordenar slot ${slot}`}
                      aria-grabbed={dragging === item.index}
                      className={cn(
                        buttonVariants({
                          size: "icon-sm",
                          variant: "ghost",
                        }),
                        "absolute start-5 top-5 z-10 cursor-grab bg-background/80 active:cursor-grabbing",
                      )}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "text/plain",
                          String(item.index),
                        );
                        e.dataTransfer.effectAllowed = "move";
                        onDragStart(item.index);
                      }}
                      onDragEnd={onDragEnd}
                    >
                      <GripVertical aria-hidden="true" />
                    </button>
                  ) : null}
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="aspect-video w-full rounded-lg object-cover outline outline-1 outline-[oklch(0_0_0_/_0.1)] dark:outline-[oklch(1_0_0_/_0.1)]"
                    />
                  ) : (
                    <div
                      className="aspect-video w-full rounded-lg bg-muted/40"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Slot {slot}
                    </p>
                    <p
                      className={cn(
                        "font-heading text-base font-medium break-words",
                        !item.empty && "text-foreground",
                      )}
                    >
                      {item.name}
                    </p>
                    {item.warning ? (
                      <p className="mt-1 text-xs font-normal text-muted-foreground">
                        {item.warning}
                      </p>
                    ) : null}
                    {meta.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {meta.join(" · ")}
                      </p>
                    ) : null}
                    {item.seed ? (
                      <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
                        {item.seed}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-auto">
                    <SaveSlotActions
                      item={item}
                      onSelect={onSelect}
                      onArchive={onArchive}
                      onExport={onExport}
                    />
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export { dash };
