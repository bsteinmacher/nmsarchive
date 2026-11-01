"use client";

import type { ReactNode } from "react";
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
import { slotCardTags } from "@/lib/auto-tags";
import { getAdapter, type AdapterColumn, type ExtractedSlot } from "@/lib/nms/extract";
import type { Category } from "@/types/nms";
import { CardOpenTarget } from "./card-open-target";
import { ExportMenu } from "./export-menu";
import { ItemTags } from "./item-tags";

function dash(value: string) {
  return value || "—";
}

export function GroupedSection({
  id,
  title,
  description,
  flush = false,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  flush?: boolean;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="min-w-0 scroll-mt-6">
      <Card className="min-w-0">
        <CardHeader className={children ? "border-b" : undefined}>
          <h2 className="font-heading text-base leading-snug font-medium">
            {title}
          </h2>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        {children ? (
          <CardContent
            className={
              flush
                ? "min-w-0 px-0 [&_td:first-child]:ps-4 [&_td:last-child]:pe-4 [&_th:first-child]:ps-4 [&_th:last-child]:pe-4"
                : undefined
            }
          >
            {children}
          </CardContent>
        ) : null}
      </Card>
    </section>
  );
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
        <ExportMenu
          variant="save"
          onArchive={() => onArchive(item)}
          onDownload={() => onExport(item)}
        />
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
  framed = false,
  sectionId,
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
  /** A tabela reserva a coluna de arrastar. A grade ignora. */
  reserveReorder?: boolean;
  framed?: boolean;
  sectionId?: string;
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
  const emptyCopy = emptyMessage ?? getAdapter(category).missingMessage;

  if (items.length === 0) {
    if (framed) {
      return (
        <GroupedSection id={sectionId} title={caption} description={emptyCopy} />
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>{caption}</CardTitle>
          <CardDescription>{emptyCopy}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const grid = (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const slot = item.slotLabel ?? String(item.index + 1);
            const isOver = over === item.index && dragging !== item.index;
            const thumb = screenshotUrl(item);
            const tags = item.empty ? [] : slotCardTags(item);
            const canOpen = !item.empty;
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
                    canOpen && "cursor-pointer",
                  )}
                >
                  {canOpen ? (
                    <CardOpenTarget
                      label={`Ver detalhes do slot ${slot}`}
                      onOpen={() => onSelect(item)}
                    />
                  ) : null}
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
                    <p
                      className={cn(
                        "font-heading text-base font-medium break-words tabular-nums",
                        !item.empty && "text-foreground",
                      )}
                    >
                      Slot {slot}
                    </p>
                    {item.empty ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.name}
                      </p>
                    ) : null}
                    {item.warning ? (
                      <p className="mt-1 text-xs font-normal text-muted-foreground">
                        {item.warning}
                      </p>
                    ) : null}
                    {tags.length > 0 ? (
                      <div className="mt-2">
                        <ItemTags tags={tags} />
                      </div>
                    ) : null}
                  </div>
                  <div className="relative z-10 mt-auto">
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
  );

  if (framed) {
    return (
      <GroupedSection
        id={sectionId}
        title={caption}
        description={description}
      >
        {grid}
      </GroupedSection>
    );
  }

  return (
    <section id={sectionId} className="grid gap-3">
      <div className="grid gap-1">
        <h2 className="font-heading text-base leading-snug font-medium">
          {caption}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {grid}
    </section>
  );
}

export { dash };
