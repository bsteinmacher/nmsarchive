"use client";

import { useId, useState, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAdapter, type ExtractedSlot } from "@/lib/nms/extract";
import { trpc } from "@/lib/trpc";
import { parseTagInput } from "@/lib/validations";
import { useSaveSession } from "@/stores/save-session";
import { type Category } from "@/types/nms";

export function ArchiveItemDialog({
  item,
  category,
  open,
  onOpenChange,
}: {
  item: ExtractedSlot | null;
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const summary = useSaveSession((s) => s.summary);
  const fileName = useSaveSession((s) => s.fileName);
  const sha256 = useSaveSession((s) => s.sha256);
  const formatHint = useSaveSession((s) => s.formatHint);
  const utils = trpc.useUtils();
  const createMeta = trpc.saves.createMetadata.useMutation();
  const archive = trpc.items.archive.useMutation();
  const descriptionId = useId();
  const tagsId = useId();
  const errorId = useId();
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = createMeta.isPending || archive.isPending;
  const adapter = getAdapter(category);

  function reset() {
    setDescription("");
    setTagsRaw("");
    setError(null);
  }

  async function commit() {
    if (!item || item.empty || item.readonly) return;
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Escreva uma descrição. Ela aparece no arquivo pessoal.");
      document.getElementById(descriptionId)?.focus();
      return;
    }
    if (!summary || !sha256) {
      toast.error("Abra um save antes de arquivar.");
      return;
    }
    setError(null);
    try {
      const save = await createMeta.mutateAsync({
        fileName: fileName ?? "save.hg",
        platform: summary.platform || "unknown",
        gameVersion: summary.gameVersion,
        formatHint: formatHint ?? undefined,
        saveName: summary.saveName || undefined,
        galaxy: summary.galaxy,
        playTimeSec: summary.playTimeSec,
        sha256,
      });
      await archive.mutateAsync({
        category,
        name: item.name,
        seed: item.seed || "0x0",
        description: trimmed,
        metadata: {
          gameVersion: summary.gameVersion,
          className: item.className || undefined,
          shipType: item.itemType || undefined,
          filename: item.filename || undefined,
          extra: item.extra,
          payload: item.payload,
        },
        galaxy: summary.galaxy,
        sourceSaveId: save.id,
        tags: parseTagInput(tagsRaw),
      });
      await Promise.all([
        utils.items.list.invalidate(),
        utils.items.counts.invalidate(),
        utils.logs.list.invalidate(),
      ]);
      toast.success(`${item.name} foi para o arquivo pessoal.`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao arquivar");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await commit();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Arquivar {item?.name ?? adapter.label}</DialogTitle>
          <DialogDescription>
            Copia este item para o SQLite. O save.hg fica só neste browser.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          {item?.warning ? (
            <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              {item.warning}
            </p>
          ) : null}
          {category === "exosuit" ? (
            <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              Só slots, posições de tech e supercharged. Substâncias e produtos
              do traje não entram no arquivo.
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor={descriptionId}>Descrição</Label>
            <Textarea
              id={descriptionId}
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              placeholder="S-class em Euclid"
            />
            {error ? (
              <p id={errorId} className="text-sm text-destructive">
                {error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Obrigatória. Serve para achar o item depois, sem abrir o save.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={tagsId}>Tags</Label>
            <Input
              id={tagsId}
              name="tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="exotic, S-class"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Separe com vírgula.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Arquivando…" : "Arquivar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
