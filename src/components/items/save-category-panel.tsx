"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCategoryCopy, useColumnHeader } from "@/i18n/format";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { ArchiveItemDialog } from "@/components/items/archive-item-dialog";
import { SaveContextSwitch } from "@/components/save/save-context-switch";
import { ListViewToggle } from "@/components/items/list-view-toggle";
import { SaveItemDetailDialog } from "@/components/items/save-item-detail-dialog";
import {
  SaveSlotActions,
  SaveSlotGrid,
  columnValue,
  dash,
} from "@/components/items/save-slot-grid";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { archivedScreenshotUrl } from "@/lib/archive-match";
import { listColumnClass } from "@/lib/list-columns";
import type { ArchiveView } from "@/lib/archive-url";
import {
  FLEET_FRIGATE_LIMIT,
  getAdapter,
  groupFrigatesForDisplay,
  isFreighterBaseSlot,
  isHiddenFromBasesMenu,
  type AdapterColumn,
  type ExtractedSlot,
} from "@/lib/nms/extract";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { trpc } from "@/lib/trpc";
import { useSaveSession } from "@/stores/save-session";
import { isReorderableCategory, type Category } from "@/types/nms";

function SlotTable({
  category,
  items,
  reorderable,
  sectionId,
  columns,
  caption,
  description,
  emptyMessage,
  dragging,
  over,
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
  sectionId?: string;
  columns: readonly AdapterColumn[];
  caption: string;
  description: string;
  emptyMessage?: string;
  dragging: number | null;
  over: number | null;
  onDragOver: (index: number) => void;
  onDrop: (from: number, to: number) => void;
  onDragLeave: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragEnd: () => void;
  onSelect: (item: ExtractedSlot) => void;
  onArchive: (item: ExtractedSlot) => void;
  onExport: (item: ExtractedSlot) => void;
  screenshotUrl?: (item: ExtractedSlot) => string | null;
}) {
  const common = useTranslations("common");
  const save = useTranslations("save");
  const header = useColumnHeader();
  const emptyCopy = emptyMessage ?? save(`missing.${category}`);

  if (items.length === 0) {
    return (
      <section id={sectionId}>
        <Card>
          <CardHeader>
            <CardTitle>{caption}</CardTitle>
            <CardDescription>{emptyCopy}</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const visibleColumns = columns.filter((col) => col.id !== "seed");
  const showReorder = reorderable;

  const table = (
      <Table className="table-fixed">
          <colgroup>
            {showReorder ? <col className="w-10" /> : null}
            <col className={listColumnClass("slot")} />
            <col />
            {visibleColumns.map((col) => (
              <col key={col.id} className={listColumnClass(col.id)} />
            ))}
            <col className="w-64" />
          </colgroup>
          <TableHeader>
            <TableRow>
              {showReorder ? (
                <TableHead className="w-10" aria-hidden={!reorderable || undefined}>
                  {reorderable ? (
                    <span className="sr-only">{common("reorder")}</span>
                  ) : null}
                </TableHead>
              ) : null}
              <TableHead className={listColumnClass("slot")}>{common("slot")}</TableHead>
              <TableHead>{common("name")}</TableHead>
              {visibleColumns.map((col) => (
                <TableHead key={col.id} className={listColumnClass(col.id)}>
                  {header(col)}
                </TableHead>
              ))}
              <TableHead className="w-64 text-right">
                {common("actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const slot = item.slotLabel ?? String(item.index + 1);
              const isOver = over === item.index && dragging !== item.index;
              return (
                <TableRow
                  key={`${item.group ?? "primary"}-${item.index}`}
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
                    (item.empty || item.readonly) && "text-muted-foreground",
                    isOver && "bg-muted",
                    dragging === item.index && "opacity-60",
                  )}
                >
                  {showReorder ? (
                    <TableCell aria-hidden={!reorderable || undefined}>
                      {reorderable ? (
                      <button
                        type="button"
                        draggable
                        tabIndex={-1}
                        aria-label={common("reorderSlot", { slot })}
                        aria-grabbed={dragging === item.index}
                        className={cn(
                          buttonVariants({
                            size: "icon-sm",
                            variant: "ghost",
                          }),
                          "cursor-grab active:cursor-grabbing",
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
                    </TableCell>
                  ) : null}
                  <TableCell className="tabular-nums">{slot}</TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-normal",
                      !item.empty && "font-medium",
                    )}
                  >
                    <span className="break-words">{item.name}</span>
                    {item.warning ? (
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {item.warning}
                      </span>
                    ) : null}
                  </TableCell>
                  {visibleColumns.map((col) => (
                    <TableCell key={col.id} className="whitespace-nowrap">
                      {dash(columnValue(item, col))}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <SaveSlotActions
                      item={item}
                      onSelect={onSelect}
                      onArchive={onArchive}
                      onExport={onExport}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
      </Table>
  );

  return (
    <section id={sectionId} className="grid gap-3">
      <div className="grid gap-1">
        <h2 className="font-heading text-base leading-snug font-medium">
          {caption}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {table}
    </section>
  );
}

export function SaveCategoryPanel({ category }: { category: Category }) {
  const status = useSaveSession((s) => s.status);
  const hydrated = useSaveSession((s) => s.hydrated);
  const summary = useSaveSession((s) => s.summary);
  const items = useSaveSession((s) => s.items[category]);
  const baseItems = useSaveSession((s) => s.items.base);
  const deepSpaceItems = useSaveSession((s) => s.items.deepspace);
  const spaceStationItems = useSaveSession((s) => s.items.spacestation);
  const exportItem = useSaveSession((s) => s.exportItem);
  const reorderSlots = useSaveSession((s) => s.reorderSlots);
  const [selected, setSelected] = useState<ExtractedSlot | null>(null);
  const [archiving, setArchiving] = useState<ExtractedSlot | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [view, setView] = useState<ArchiveView>("table");
  const archived = trpc.items.list.useQuery(
    { category },
    { enabled: status === "ready" },
  );
  const archivedItems = archived.data?.items ?? [];

  const t = useTranslations("save");
  const common = useTranslations("common");
  const categories = useCategoryCopy();
  const adapter = getAdapter(category);
  const reorderable = isReorderableCategory(category);
  const primary = items.filter((item) => {
    if (item.group === "automatic") return false;
    if (category === "base" && isHiddenFromBasesMenu(item)) return false;
    if (category === "freighter" && item.index !== 0) return false;
    return true;
  });
  const automatic = items.filter((item) => item.group === "automatic");
  const interiorBases =
    category === "freighter" ? baseItems.filter(isFreighterBaseSlot) : [];
  const listed =
    category === "frigate"
      ? groupFrigatesForDisplay(primary).flatMap((group) => group.items)
      : primary;
  const planetDeepSpace = category === "base" ? deepSpaceItems : [];
  const planetStations = category === "base" ? spaceStationItems : [];
  const filled = listed.filter((item) => !item.empty && !item.readonly).length;
  const navItems = selected
    ? selected.group === "automatic"
      ? automatic
      : interiorBases.some(
            (item) =>
              item.index === selected.index &&
              item.category === selected.category,
          )
        ? interiorBases
        : planetDeepSpace.some(
              (item) =>
                item.index === selected.index &&
                item.category === selected.category,
            )
          ? planetDeepSpace
          : planetStations.some(
                (item) =>
                  item.index === selected.index &&
                  item.category === selected.category,
              )
            ? planetStations
            : listed
    : listed;

  async function moveSlot(from: number, to: number, cat: Category = category) {
    if (from === to || to < 0) return;
    try {
      await reorderSlots(cat, from, to);
      setLiveMessage(common("slotMoved", { from: from + 1, to: to + 1 }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : common("failReorder"));
    }
  }

  function onExport(item: ExtractedSlot) {
    try {
      downloadNmsItemFile(exportItem(item.category, item.index));
      toast.success(common("exportedNmsitem"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : common("failExport"));
    }
  }

  if (!hydrated || status === "hydrating") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("loadingSession")}</CardTitle>
          <CardDescription>{t("loadingSessionHint")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status !== "ready" || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("noOpenSave")}</CardTitle>
          <CardDescription>
            {t("loadSaveHint", { label: categories.label(category) })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/save" className={cn(buttonVariants())}>
            {t("goDashboard")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const slotCount =
    category === "frigate" ? FLEET_FRIGATE_LIMIT : listed.length;
  const caption =
    category === "exosuit"
      ? t("exosuitCaption")
      : category === "freighter"
        ? t("freighterCaption")
        : t("filledCaption", {
            label: categories.label(category),
            filled,
            slots: slotCount,
          });

  const description =
    category === "frigate"
      ? t("frigateDescription")
      : category === "squadron"
        ? t("squadronDescription")
      : reorderable
    ? t("reorderDescription")
    : category === "exosuit"
      ? t("exosuitDescription")
      : category === "base"
        ? t("baseDescription")
        : category === "deepspace"
          ? t("deepspaceDescription")
          : category === "spacestation"
            ? t("stationDescription")
            : category === "wonder"
          ? t("wonderDescription")
          : category === "freighter"
            ? t("freighterDescription")
            : categories.description(category);

  const screenshotUrl = (item: ExtractedSlot) =>
    archivedScreenshotUrl(archivedItems, item);

  function reorderHandlersFor(cat: Category) {
    return {
      dragging,
      over,
      onDragOver: setOver,
      onDrop: (from: number, to: number) => {
        setDragging(null);
        setOver(null);
        void moveSlot(from, to, cat);
      },
      onDragLeave: (index: number) => {
        setOver((current) => (current === index ? null : current));
      },
      onDragStart: setDragging,
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
      },
    };
  }
  const idleHandlers = {
    dragging: null,
    over: null,
    onDragOver: () => {},
    onDrop: () => {},
    onDragLeave: () => {},
    onDragStart: () => {},
    onDragEnd: () => {},
  };

  const SlotList = view === "grid" ? SaveSlotGrid : SlotTable;
  const baseColumns = getAdapter("base").columns;

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <SaveContextSwitch />
          <div className="ml-auto">
            <ListViewToggle value={view} onChange={setView} />
          </div>
        </div>
        <div
          className={
            category === "freighter" || category === "base"
              ? "grid min-w-0 gap-8"
              : "contents"
          }
        >
        <SlotList
          category={category}
          items={listed}
          reorderable={reorderable}
          columns={adapter.columns}
          caption={caption}
          description={description}
          emptyMessage={
            category === "base"
              ? t("emptyPlanet")
              : category === "deepspace"
                ? t("emptyDeepspace")
                : category === "spacestation"
                  ? t("emptyStation")
                  : undefined
          }
          screenshotUrl={screenshotUrl}
          {...reorderHandlersFor(category)}
          onSelect={setSelected}
          onArchive={setArchiving}
          onExport={onExport}
        />
        {category === "freighter" ? (
          <SlotList
            category="base"
            items={interiorBases}
            reorderable={false}
            sectionId="freighter-base"
            columns={baseColumns}
            caption={
              interiorBases.length <= 1
                ? t("freighterBaseCaption")
                : t("freighterBaseCount", { count: interiorBases.length })
            }
            description={t("freighterBaseBody")}
            emptyMessage={t("emptyFreighterBase")}
            screenshotUrl={screenshotUrl}
            {...idleHandlers}
            onSelect={setSelected}
            onArchive={setArchiving}
            onExport={onExport}
          />
        ) : null}
        {category === "base" ? (
          <>
          <SlotList
            category="deepspace"
            items={planetDeepSpace}
            reorderable={false}
            sectionId="deepspace"
            columns={getAdapter("deepspace").columns}
            caption={t("deepSpaceCount", {
              count: planetDeepSpace.filter((item) => !item.empty).length,
            })}
            description={t("deepSpaceBody")}
            emptyMessage={t("emptyDeepspaceShort")}
            screenshotUrl={screenshotUrl}
            {...idleHandlers}
            onSelect={setSelected}
            onArchive={setArchiving}
            onExport={onExport}
          />
          <SlotList
            category="spacestation"
            items={planetStations}
            reorderable={false}
            sectionId="spacestations"
            columns={getAdapter("spacestation").columns}
            caption={t("stationsCount", {
              count: planetStations.filter((item) => !item.empty).length,
            })}
            description={t("stationsBody")}
            emptyMessage={t("emptyStationShort")}
            screenshotUrl={screenshotUrl}
            {...idleHandlers}
            onSelect={setSelected}
            onArchive={setArchiving}
            onExport={onExport}
          />
          </>
        ) : null}
        </div>
        {automatic.length > 0 ? (
          <SlotList
            category={category}
            items={automatic}
            reorderable={false}
            columns={[
              { id: "itemType", header: "Type" },
              { id: "stat", header: "Stat" },
              { id: "seed", header: "Seed" },
            ]}
            caption={t("automaticCaption", { count: automatic.length })}
            description={t("automaticBody")}
            screenshotUrl={screenshotUrl}
            {...idleHandlers}
            onSelect={setSelected}
            onArchive={() => {}}
            onExport={() => {}}
          />
        ) : null}
      </div>
      <SaveItemDetailDialog
        item={selected}
        category={selected?.category ?? category}
        open={selected != null}
        navItems={navItems}
        onNavigate={setSelected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onArchive={(item) => {
          setSelected(null);
          setArchiving(item);
        }}
      />
      <ArchiveItemDialog
        item={archiving}
        category={archiving?.category ?? category}
        open={archiving != null}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
      />
    </>
  );
}
