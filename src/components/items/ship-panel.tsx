"use client";

import { useState } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
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
import type { ExtractedShip } from "@/lib/nms/extract/types";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { useSaveSession } from "@/stores/save-session";
import { ShipDetailDialog } from "./ship-detail-dialog";

function dash(value: string) {
  return value || "—";
}

export function ShipPanel() {
  const status = useSaveSession((s) => s.status);
  const hydrated = useSaveSession((s) => s.hydrated);
  const ships = useSaveSession((s) => s.ships);
  const summary = useSaveSession((s) => s.summary);
  const exportShip = useSaveSession((s) => s.exportShip);
  const reorderShips = useSaveSession((s) => s.reorderShips);
  const [selected, setSelected] = useState<ExtractedShip | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  async function moveSlot(from: number, to: number) {
    if (from === to || to < 0 || to >= ships.length) return;
    try {
      await reorderShips(from, to);
      setLiveMessage(
        `Slot ${from + 1} trocado com o slot ${to + 1}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao reordenar");
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
            Carregue um save.hg no dashboard para ver os 12 slots de nave,
            inclusive os vazios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={cn(buttonVariants())}>
            Ir ao dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  const filled = ships.filter((s) => !s.empty).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            Naves no save ({filled} preenchidas / {summary.shipSlots} slots)
          </CardTitle>
          <CardDescription>
            Arraste pela alça para trocar de lugar — slots vazios entram na
            troca e o array não muda de tamanho.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p role="status" aria-live="polite" className="sr-only">
            {liveMessage}
          </p>
          {ships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este save não tem ShipOwnership. A categoria fica indisponível até
              o jogo criar os slots.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">Reordenar</span>
                  </TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Ship Type</TableHead>
                  <TableHead>Seed</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ships.map((ship) => {
                  const slot = ship.index + 1;
                  const isOver = over === ship.index && dragging !== ship.index;
                  return (
                    <TableRow
                      key={ship.index}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setOver(ship.index);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = Number(
                          e.dataTransfer.getData("text/plain"),
                        );
                        setDragging(null);
                        setOver(null);
                        if (Number.isInteger(from)) void moveSlot(from, ship.index);
                      }}
                      onDragLeave={() => {
                        setOver((current) =>
                          current === ship.index ? null : current,
                        );
                      }}
                      className={cn(
                        ship.empty && "text-muted-foreground",
                        isOver && "bg-muted",
                        dragging === ship.index && "opacity-60",
                      )}
                    >
                      <TableCell>
                        <button
                          type="button"
                          draggable
                          tabIndex={-1}
                          aria-label={`Reordenar slot ${slot}`}
                          aria-grabbed={dragging === ship.index}
                          className={cn(
                            buttonVariants({ size: "icon-sm", variant: "ghost" }),
                            "cursor-grab active:cursor-grabbing",
                          )}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "text/plain",
                              String(ship.index),
                            );
                            e.dataTransfer.effectAllowed = "move";
                            setDragging(ship.index);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setOver(null);
                          }}
                        >
                          <GripVertical aria-hidden="true" />
                        </button>
                      </TableCell>
                      <TableCell className="tabular-nums">{slot}</TableCell>
                      <TableCell className={cn(!ship.empty && "font-medium")}>
                        {ship.name}
                      </TableCell>
                      <TableCell>{dash(ship.className)}</TableCell>
                      <TableCell>{dash(ship.shipType)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {dash(ship.seed)}
                      </TableCell>
                      <TableCell className="text-right">
                        {ship.empty ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelected(ship)}
                            >
                              Ver detalhes
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                try {
                                  downloadNmsItemFile(exportShip(ship.index));
                                  toast.success("Exportado .nmsitem");
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Falha no export",
                                  );
                                }
                              }}
                            >
                              Exportar
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ShipDetailDialog
        ship={selected}
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
