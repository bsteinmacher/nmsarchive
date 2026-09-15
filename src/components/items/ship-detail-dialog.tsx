"use client";

import type { ExtractedShip } from "@/lib/nms/extract/types";
import { SaveItemDetailDialog } from "./save-item-detail-dialog";

export function ShipDetailDialog({
  ship,
  open,
  onOpenChange,
  onArchive,
}: {
  ship: ExtractedShip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: (ship: ExtractedShip) => void;
}) {
  return (
    <SaveItemDetailDialog
      item={ship}
      category="ship"
      open={open}
      onOpenChange={onOpenChange}
      onArchive={
        onArchive
          ? (item) => onArchive(item as ExtractedShip)
          : undefined
      }
    />
  );
}
