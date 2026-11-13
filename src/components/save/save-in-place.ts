"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { downloadBytes } from "@/lib/download";
import type { SaveInPlaceResult } from "@/stores/save-location";
import { pushSessionActivity } from "@/stores/session-activity";
import { useSaveSession } from "@/stores/save-session";

function currentSaveNames(fileName?: string) {
  const session = useSaveSession.getState();
  return {
    fileName: fileName ?? session.fileName,
    saveName: session.summary?.saveName,
  };
}

export function useSaveReportCopy() {
  const t = useTranslations("save");
  return {
    unbound: t("unbound"),
    downloaded: (backup: string, file: string) =>
      t("downloadedPair", { backup, file }),
    saved: (file: string, backup: string) =>
      t("savedWithBackup", { file, backup }),
  };
}

type SaveReportCopy = {
  unbound: string;
  downloaded: (backup: string, file: string) => string;
  saved: (file: string, backup: string) => string;
};

export async function reportSaveInPlace(
  result: SaveInPlaceResult,
  onStale: () => void,
  copy: SaveReportCopy,
): Promise<boolean> {
  if (result.status === "stale") {
    onStale();
    return false;
  }
  if (result.status === "unbound") {
    toast.error(copy.unbound);
    return false;
  }
  if (result.status === "cancelled") {
    pushSessionActivity("cancel", currentSaveNames());
    return false;
  }
  if (result.status === "export") {
    downloadBytes(result.backupName, result.backupBytes);
    downloadBytes(result.fileName, result.bytes);
    pushSessionActivity("save", currentSaveNames(result.fileName));
    toast.success(copy.downloaded(result.backupName, result.fileName));
    return true;
  }
  pushSessionActivity("save", currentSaveNames(result.fileName));
  toast.success(copy.saved(result.fileName, result.backupName));
  return true;
}
