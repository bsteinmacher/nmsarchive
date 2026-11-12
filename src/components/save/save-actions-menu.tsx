"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronUp, Download, Save } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadBytes } from "@/lib/download";
import { fsErrorMessage } from "@/lib/nms/fs-access";
import { useSaveLocation } from "@/stores/save-location";
import { useSaveSession } from "@/stores/save-session";
import { pushSessionActivity } from "@/stores/session-activity";
import { reportSaveInPlace, useSaveReportCopy } from "./save-in-place";

export function SaveActionsMenu() {
  const dirty = useSaveSession((s) => s.dirty);
  const status = useSaveSession((s) => s.status);
  const origin = useSaveSession((s) => s.origin);
  const fileName = useSaveSession((s) => s.fileName);
  const saveName = useSaveSession((s) => s.summary?.saveName);
  const downloadRewritten = useSaveSession((s) => s.downloadRewritten);
  const writing = useSaveLocation((s) => s.writing);
  const saveInPlace = useSaveLocation((s) => s.saveInPlace);
  const t = useTranslations("save");
  const common = useTranslations("common");
  const reportCopy = useSaveReportCopy();
  const [confirmStale, setConfirmStale] = useState(false);
  const ready = status === "ready";
  const canSaveInPlace = ready && origin === "directory";

  useEffect(() => {
    if (!ready || !dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [ready, dirty]);

  async function onSave(force = false) {
    try {
      const result = await saveInPlace(force);
      await reportSaveInPlace(result, () => setConfirmStale(true), reportCopy);
    } catch (err) {
      toast.error(fsErrorMessage(err));
    }
  }

  async function onDownloadEdited() {
    try {
      const bytes = await downloadRewritten();
      const name = (fileName ?? "save.hg").replace(/(\.hg)?$/i, "-edited.hg");
      downloadBytes(name, bytes);
      pushSessionActivity("save", { fileName, saveName });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : common("failRecompress"),
      );
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={writing}
          render={
            <Button
              type="button"
              className="w-full"
              variant={dirty ? "default" : "outline"}
              disabled={writing}
            />
          }
        >
          <Save />
          {writing ? common("saving") : common("save")}
          <ChevronUp className="ms-auto" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6}>
          <DropdownMenuItem
            disabled={!canSaveInPlace || writing}
            onClick={() => void onSave(false)}
          >
            <Save />
            {t("saveHere")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!ready || writing}
            onClick={() => void onDownloadEdited()}
          >
            <Download />
            {t("downloadEdited")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmStale} onOpenChange={setConfirmStale}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("diskChangedTitle")}</DialogTitle>
            <DialogDescription>{t("diskChangedBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmStale(false);
                pushSessionActivity("cancel", { fileName, saveName });
              }}
            >
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                setConfirmStale(false);
                void onSave(true);
              }}
            >
              {t("saveAnyway")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
