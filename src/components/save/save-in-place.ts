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

export async function reportSaveInPlace(
  result: SaveInPlaceResult,
  onStale: () => void,
): Promise<boolean> {
  if (result.status === "stale") {
    onStale();
    return false;
  }
  if (result.status === "unbound") {
    toast.error(
      "Esse save não está ligado à pasta. Abra o arquivo de novo, ou baixe uma cópia.",
    );
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
    toast.success(
      `Backup ${result.backupName} e o save ${result.fileName} foram baixados.`,
    );
    return true;
  }
  pushSessionActivity("save", currentSaveNames(result.fileName));
  toast.success(`Salvo em ${result.fileName}. Backup ${result.backupName}.`);
  return true;
}
