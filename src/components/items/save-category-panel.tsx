"use client";

import { useState } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { ArchiveItemDialog } from "@/components/items/archive-item-dialog";
import { SaveItemDetailDialog } from "@/components/items/save-item-detail-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  getAdapter,
  type AdapterColumn,
  type ExtractedSlot,
} from "@/lib/nms/extract";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { useSaveSession } from "@/stores/save-session";
import {
  CATEGORY_META,
  isReorderableCategory,
  type Category,
} from "@/types/nms";

function dash(value: string) {
  return value || "—";
}

function columnValue(item: ExtractedSlot, col: AdapterColumn): string {
  if (col.id === "className") return item.className;
  if (col.id === "itemType") return item.itemType;
  if (col.id === "seed") return item.seed;
  return item.extra[col.id] ?? "";
}

function SlotTable({
  category,
  items,
  reorderable,
  columns,
  caption,
  description,
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
  columns: readonly AdapterColumn[];
  caption: string;
  description: string;
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
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {getAdapter(category).missingMessage}
      </p>
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
              const canAct = !item.empty && !item.readonly;
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
                    {canAct ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelect(item)}
                        >
                          Ver detalhes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onArchive(item)}
                        >
                          Arquivar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onExport(item)}
                        >
                          Exportar
                        </Button>
                      </div>
                    ) : item.readonly ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelect(item)}
                      >
                        Ver detalhes
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
  const exportItem = useSaveSession((s) => s.exportItem);
  const reorderSlots = useSaveSession((s) => s.reorderSlots);
  const [selected, setSelected] = useState<ExtractedSlot | null>(null);
  const [archiving, setArchiving] = useState<ExtractedSlot | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const adapter = getAdapter(category);
  const meta = CATEGORY_META[category];
  const reorderable = isReorderableCategory(category);
  const primary = items.filter((item) => item.group !== "automatic");
  const automatic = items.filter((item) => item.group === "automatic");
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
      downloadNmsItemFile(exportItem(category, item.index));
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
        ? "Bases com muitos Objects[] geram um .nmsitem grande. O inventário da cargueira viaja no payload dela, não aqui."
        : category === "wonder"
          ? "Personal Wonders (escolha do jogador). Records automáticos ficam na lista abaixo, só leitura."
          : category === "freighter"
            ? "A cargueira atual leva os três inventários no payload. A frota extra aparece nos slots seguintes."
            : meta.description;

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>
      <div className="flex flex-col gap-6">
        <SlotTable
          category={category}
          items={primary}
          reorderable={reorderable}
          columns={adapter.columns}
          caption={caption}
          description={description}
          dragging={dragging}
          over={over}
          onDragOver={setOver}
          onDrop={(from, to) => {
            setDragging(null);
            setOver(null);
            void moveSlot(from, to);
          }}
          onDragLeave={(index) => {
            setOver((current) => (current === index ? null : current));
          }}
          onDragStart={setDragging}
          onDragEnd={() => {
            setDragging(null);
            setOver(null);
          }}
          onSelect={setSelected}
          onArchive={setArchiving}
          onExport={onExport}
        />
        {automatic.length > 0 ? (
          <SlotTable
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
            dragging={null}
            over={null}
            onDragOver={() => {}}
            onDrop={() => {}}
            onDragLeave={() => {}}
            onDragStart={() => {}}
            onDragEnd={() => {}}
            onSelect={setSelected}
            onArchive={() => {}}
            onExport={() => {}}
          />
        ) : null}
      </div>
      <SaveItemDetailDialog
        item={selected}
        category={category}
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
        category={category}
        open={archiving != null}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
      />
    </>
  );
}
