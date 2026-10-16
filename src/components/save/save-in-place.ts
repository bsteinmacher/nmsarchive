import { toast } from "sonner";
import { downloadBytes } from "@/lib/download";
import type { SaveInPlaceResult } from "@/stores/save-location";

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
  if (result.status === "cancelled") return false;
  if (result.status === "export") {
    downloadBytes(result.backupName, result.backupBytes);
    downloadBytes(result.fileName, result.bytes);
    toast.success(
      `Backup ${result.backupName} e o save ${result.fileName} foram baixados.`,
    );
    return true;
  }
  toast.success(`Salvo em ${result.fileName}. Backup ${result.backupName}.`);
  return true;
}
