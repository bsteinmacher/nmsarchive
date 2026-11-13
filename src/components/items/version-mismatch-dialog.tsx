"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("common");
  const archive = useTranslations("archive");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{archive("versionTitle")}</DialogTitle>
          <DialogDescription>
            {archive("versionApply", { warning: warning ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button onClick={onConfirm}>{archive("applyAnyway")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
