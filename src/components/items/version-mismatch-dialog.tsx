"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function VersionMismatchDialog({
  warning,
  open,
  onCancel,
  onConfirm,
}: {
  warning: string | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Versões diferentes</DialogTitle>
          <DialogDescription>
            {warning} O apply não é bloqueado, mas o jogo pode ignorar campos
            novos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>Aplicar mesmo assim</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
