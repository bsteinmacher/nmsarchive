"use client";

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
import type { ExtractedShip } from "@/lib/nms/extract/types";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { useSaveSession } from "@/stores/save-session";
import { JsonTree } from "./json-tree";

export function ShipDetailDialog({
  ship,
  open,
  onOpenChange,
}: {
  ship: ExtractedShip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const exportShip = useSaveSession((s) => s.exportShip);
  const slot = ship ? ship.index + 1 : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ship?.name ?? "Nave"}</DialogTitle>
          <DialogDescription>
            Slot {slot ?? "—"} · Classe {ship?.className ?? "?"} ·{" "}
            {ship?.shipType || "tipo desconhecido"} · {ship?.seed}
          </DialogDescription>
        </DialogHeader>
        {ship?.filename ? (
          <p className="font-mono text-xs break-all text-muted-foreground">
            Filename: {ship.filename}
          </p>
        ) : null}
        {ship ? <JsonTree value={ship.payload} /> : null}
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              if (!ship) return;
              try {
                downloadNmsItemFile(exportShip(ship.index));
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
