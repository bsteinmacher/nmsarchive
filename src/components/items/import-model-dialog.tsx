"use client";

import { useState } from "react";
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
import { payloadTypeLabel } from "@/lib/nms/extract/apply-depth";
import type { ExtractedSlot } from "@/lib/nms/extract/types";
import { asRecord, asString } from "@/lib/nms/value";
import { buildNmsItem } from "@/lib/nmsitem";
import { screenshotPublicUrl } from "@/lib/screenshots";
import { trpc } from "@/lib/trpc";
import { useSaveSession } from "@/stores/save-session";
import { isCategory } from "@/types/nms";
import { cn } from "cn";

function freighterRoleError(destIndex: number, payload: unknown): string | null {
  const kind = asString(asRecord(payload)?.kind);
  if (destIndex === 0 && kind !== "current") {
    return "Esta cargueira é da frota e não entra no slot Atual.";
  }
  if (destIndex !== 0 && kind === "current") {
    return "Esta cargueira é a atual e só entra no slot Atual.";
  }
  return null;
}

export function ImportModelDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ExtractedSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importItem = useSaveSession((s) => s.importItem);
  const selectionKey = open ? `${item?.category ?? ""}:${item?.index ?? ""}` : "";
  const [picked, setPicked] = useState<{ key: string; id: string | null }>({
    key: "",
    id: null,
  });
  if (picked.key !== selectionKey) {
    setPicked({ key: selectionKey, id: null });
  }
  const selectedId = picked.id;
  const [pending, setPending] = useState(false);
  const list = trpc.items.list.useQuery(
    { category: item?.category },
    { enabled: open && item != null },
  );
  const detail = trpc.items.get.useQuery(
    { id: selectedId ?? "" },
    { enabled: open && selectedId != null },
  );

  const sourceType =
    detail.data && isCategory(detail.data.category)
      ? detail.data.shipType || payloadTypeLabel(detail.data.category, detail.data.payload)
      : "";
  const typeChanges =
    item != null &&
    item.itemType !== "" &&
    sourceType !== "" &&
    item.itemType !== sourceType;
  const roleError =
    item?.category === "freighter" && detail.data
      ? freighterRoleError(item.index, detail.data.payload)
      : null;

  async function onConfirm() {
    if (!item || !detail.data || !isCategory(detail.data.category) || roleError) {
      return;
    }
    setPending(true);
    try {
      const file = buildNmsItem({
        category: detail.data.category,
        name: detail.data.name,
        seed: detail.data.seed,
        payload: detail.data.payload,
        gameVersion: detail.data.gameVersion ?? 0,
        description: detail.data.description,
        tags: detail.data.tags.map((tag) => tag.label),
        galaxy: detail.data.galaxy ?? undefined,
      });
      await importItem(file, { index: item.index, depth: "supercharged" });
      toast.success(`Modelo aplicado em ${item.name}.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao importar o modelo");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar modelo</DialogTitle>
          <DialogDescription>
            Em cima de {item?.name ?? "este slot"}. O nome, a posição, a tech e
            o inventário deste slot ficam.
          </DialogDescription>
        </DialogHeader>
        {list.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando arquivo…</p>
        ) : list.error ? (
          <p className="text-sm text-destructive">{list.error.message}</p>
        ) : list.data && list.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum item desta categoria no arquivo.
          </p>
        ) : (
          <div className="grid gap-2">
            {list.data?.items.map((archived) => {
              const bits = [
                archived.shipType,
                archived.className ? `Class ${archived.className}` : "",
              ].filter(Boolean);
              const selected = archived.id === selectedId;
              const thumb = screenshotPublicUrl(archived.screenshotPath);
              return (
                <button
                  key={archived.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left",
                    selected && "border-ring bg-muted/40",
                  )}
                  onClick={() => setPicked({ key: selectionKey, id: archived.id })}
                >
                  {selected ? (
                    thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="mb-2 aspect-video w-full rounded-lg object-cover outline outline-1 outline-[oklch(0_0_0_/_0.1)] dark:outline-[oklch(1_0_0_/_0.1)]"
                      />
                    ) : (
                      <div
                        className="mb-2 aspect-video w-full rounded-lg bg-muted/40"
                        aria-hidden="true"
                      />
                    )
                  ) : null}
                  <span className="block text-sm font-medium">{archived.name}</span>
                  {bits.length > 0 ? (
                    <span className="block text-sm text-muted-foreground">
                      {bits.join(" · ")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        {typeChanges && item ? (
          <p className="text-sm">
            {item.itemType} passa a ser {sourceType}. A tech que ficar neste
            slot pode não servir no tipo novo.
          </p>
        ) : null}
        {roleError ? <p className="text-sm text-destructive">{roleError}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm()}
            disabled={!detail.data || pending || roleError != null}
          >
            {pending ? "Importando…" : "Importar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
