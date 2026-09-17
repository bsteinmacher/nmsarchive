"use client";

import { useState } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { ArchiveItemDialog } from "@/components/items/archive-item-dialog";
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
import type { ArchiveView } from "@/lib/archive-url";
import {
  getAdapter,
  isFreighterBaseSlot,
  isHiddenFromBasesMenu,
  type AdapterColumn,
  type ExtractedSlot,
} from "@/lib/nms/extract";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { trpc } from "@/lib/trpc";
import { useSaveSession } from "@/stores/save-session";
import {
  CATEGORY_META,
  isReorderableCategory,
  type Category,
} from "@/types/nms";

function SlotTable({
  category,
  items,
  reorderable,
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
  screenshotUrl: _screenshotUrl,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{caption}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {reorderable ? (
                <TableHead className="w-10">
                  <span className="sr-only">Reordenar</span>
                </TableHead>
              ) : null}
              <TableHead>Slot</TableHead>
              <TableHead>Nome</TableHead>
              {columns.map((col) => (
                <TableHead key={col.id}>{col.header}</TableHead>
              ))}
              <TableHead className="text-right">Ações</TableHead>
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
                  {reorderable ? (
                    <TableCell>
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
                    </TableCell>
                  ) : null}
                  <TableCell className="tabular-nums">{slot}</TableCell>
                  <TableCell className={cn(!item.empty && "font-medium")}>
                    <span className="break-words">{item.name}</span>
                    {item.warning ? (
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {item.warning}
                      </span>
                    ) : null}
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn(col.id === "seed" && "font-mono text-xs")}
                    >
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
      </CardContent>
    </Card>
  );
}

export function SaveCategoryPanel({ category }: { category: Category }) {
  const status = useSaveSession((s) => s.status);
  const hydrated = useSaveSession((s) => s.hydrated);
  const summary = useSaveSession((s) => s.summary);
  const items = useSaveSession((s) => s.items[category]);
  const baseItems = useSaveSession((s) => s.items.base);
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

  const adapter = getAdapter(category);
  const baseAdapter = getAdapter("base");
  const meta = CATEGORY_META[category];
  const reorderable = isReorderableCategory(category);
  const primary = items.filter((item) => {
    if (item.group === "automatic") return false;
    if (category === "base" && isHiddenFromBasesMenu(item)) return false;
    return true;
  });
  const automatic = items.filter((item) => item.group === "automatic");
  const interiorBases =
    category === "freighter" ? baseItems.filter(isFreighterBaseSlot) : [];
  const filled = primary.filter((item) => !item.empty && !item.readonly).length;

  async function moveSlot(from: number, to: number) {
    if (from === to || to < 0) return;
    try {
      await reorderSlots(category, from, to);
      setLiveMessage(`Slot ${from + 1} trocado com o slot ${to + 1}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reordenar");
    }
  }

  function onExport(item: ExtractedSlot) {
    try {
      downloadNmsItemFile(exportItem(item.category, item.index));
      toast.success("Exportado .nmsitem");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no export");
    }
  }

  if (!hydrated || status === "hydrating") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando sessão</CardTitle>
          <CardDescription>
            Recuperando o save do IndexedDB neste browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status !== "ready" || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhum save aberto</CardTitle>
          <CardDescription>
            Carregue um save.hg no dashboard para ver {meta.label.toLowerCase()}{" "}
            do save aberto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/save" className={cn(buttonVariants())}>
            Ir ao dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  const caption =
    category === "exosuit"
      ? "Layout do traje"
      : `${adapter.label} no save (${filled} preenchida${filled === 1 ? "" : "s"} / ${primary.length} slots)`;

  const description = reorderable
    ? "Arraste pela alça para trocar de lugar — slots vazios entram na troca e o array não muda de tamanho."
    : category === "exosuit"
      ? "Só quantidade de slots e posição das tecnologias. Substâncias e produtos ficam no save, fora do arquivo."
      : category === "base"
        ? "Bases planetárias e de nave. Interior da cargueira, Deep Space e Space Station ficam nos menus próprios."
        : category === "deepspace"
          ? "Bases orbitais livres. Entram no mesmo array das bases planetárias; não há limite separado no JSON."
          : category === "spacestation"
            ? "Estação espacial reivindicada. O jogo aceita até 20 por save; a 21ª é recusada ao aplicar."
            : category === "wonder"
          ? "Personal Wonders (escolha do jogador). Records automáticos ficam na lista abaixo, só leitura."
          : category === "freighter"
            ? "A nave e os três inventários ficam nesta lista. A construção do interior é a base abaixo."
            : meta.description;

  const screenshotUrl = (item: ExtractedSlot) =>
    archivedScreenshotUrl(archivedItems, item);

  const reorderHandlers = {
    dragging,
    over,
    onDragOver: setOver,
    onDrop: (from: number, to: number) => {
      setDragging(null);
      setOver(null);
      void moveSlot(from, to);
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

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <ListViewToggle value={view} onChange={setView} />
        </div>
        <SlotList
          category={category}
          items={primary}
          reorderable={reorderable}
          columns={adapter.columns}
          caption={caption}
          description={description}
          emptyMessage={
            category === "base"
              ? "Nenhuma base planetária ou de nave neste save. Interior da cargueira fica em Cargueiras; orbitais em Deep Space; estações em Space Station."
              : category === "deepspace"
                ? "Nenhuma base Deep Space neste save. O jogo adiciona uma quando você constrói com o Deep-Space Base Computer."
                : category === "spacestation"
                  ? "Nenhuma Space Station reivindicada neste save. O jogo aceita até 20 por save."
                  : undefined
          }
          screenshotUrl={screenshotUrl}
          {...reorderHandlers}
          onSelect={setSelected}
          onArchive={setArchiving}
          onExport={onExport}
        />
        {category === "freighter" ? (
          <SlotList
            category="base"
            items={interiorBases}
            reorderable={false}
            columns={baseAdapter.columns}
            caption={
              interiorBases.length <= 1
                ? "Base da cargueira"
                : `Base da cargueira (${interiorBases.length})`
            }
            description="A construção do interior. Arquivar a nave não inclui esta construção."
            emptyMessage="Este save não tem uma base de cargueira. O jogo cria uma quando você constrói no interior."
            screenshotUrl={screenshotUrl}
            {...idleHandlers}
            onSelect={setSelected}
            onArchive={setArchiving}
            onExport={onExport}
          />
        ) : null}
        {automatic.length > 0 ? (
          <SlotList
            category={category}
            items={automatic}
            reorderable={false}
            columns={[
              { id: "itemType", header: "Tipo" },
              { id: "stat", header: "Stat" },
              { id: "seed", header: "Seed" },
            ]}
            caption={`Records automáticos (${automatic.length})`}
            description="Descobertas que o jogo guarda sozinho. Só leitura — não vão para o arquivo nem para .nmsitem."
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
