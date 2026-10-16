"use client";

import type { ExtractedSlot } from "@/lib/nms/extract/types";
import { ApplyToSaveDialog } from "./apply-to-save-dialog";

export function ImportModelDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ExtractedSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ApplyToSaveDialog
      open={open && item != null}
      onOpenChange={onOpenChange}
      destSlot={item}
    />
  );
}
