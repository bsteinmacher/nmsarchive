"use client";

import type { ExtractedShip } from "@/lib/nms/extract/types";
import { ArchiveItemDialog } from "./archive-item-dialog";

export function ArchiveShipDialog({
  ship,
  open,
  onOpenChange,
}: {
  ship: ExtractedShip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ArchiveItemDialog
      item={ship}
      category="ship"
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
