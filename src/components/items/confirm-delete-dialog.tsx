"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/10 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="grid w-full max-w-md gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10">
        <div className="grid gap-2">
          <h2 id={titleId} className="font-heading text-base font-medium">
            {title}
          </h2>
          <p id={descId} className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            autoFocus
            onClick={onCancel}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Excluindo…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
