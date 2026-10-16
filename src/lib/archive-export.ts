import { toast } from "sonner";
import {
  archiveEnvelopeCategory,
} from "@/lib/archive-match";
import {
  buildNmsItem,
  type NmsItemFile,
} from "@/lib/nmsitem";
import { isCategory } from "@/types/nms";
import type { ArchivedItemDetail } from "@/types/archive";

export function archivedToNmsItem(item: ArchivedItemDetail): NmsItemFile | null {
  const envelope = archiveEnvelopeCategory({
    category: item.category,
    shipType: item.shipType,
    extra: item.metadata.extra,
  });
  if (!envelope || !isCategory(envelope)) {
    toast.error("Categoria desconhecida neste arquivo.");
    return null;
  }
  return buildNmsItem({
    category: envelope,
    name: item.name,
    seed: item.seed,
    payload: item.payload,
    gameVersion: item.gameVersion ?? 0,
    description: item.description,
    galaxy: item.galaxy ?? undefined,
    tags: item.tags.map((t) => t.label),
  });
}
