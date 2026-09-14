"use client";

import { useState } from "react";
import Link from "next/link";
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

export function ShipPanel() {
  const status = useSaveSession((s) => s.status);
  const hydrated = useSaveSession((s) => s.hydrated);
  const ships = useSaveSession((s) => s.ships);
  const summary = useSaveSession((s) => s.summary);
  const exportShip = useSaveSession((s) => s.exportShip);
  const [selected, setSelected] = useState<ExtractedShip | null>(null);

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
            Carregue um <code>save.hg</code> no dashboard para listar naves.
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            ShipOwnership ({ships.length} preenchidas / {summary.shipSlots}{" "}
            slots)
          </CardTitle>
          <CardDescription>
            Slots vazios (<code>Resource.Filename == &quot;&quot;</code>) ficam
            de fora. Importar usa o primeiro vazio, sem expandir o array.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma nave preenchida neste save.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Seed</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ships.map((ship) => (
                  <TableRow key={`${ship.index}-${ship.seed}`}>
                    <TableCell className="font-medium">{ship.name}</TableCell>
                    <TableCell>{ship.className}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {ship.seed}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs">
                      {ship.filename.split("/").pop()}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(ship)}
                      >
                        Detalhes
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
                    </TableCell>
                  </TableRow>
                ))}
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
