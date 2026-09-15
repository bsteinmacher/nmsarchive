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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CompanionRankField } from "@/components/items/companion-rank-field";
import { getAdapter, isFreighterBaseSlot, type ExtractedSlot } from "@/lib/nms/extract";
import {
  companionRankExtra,
  emptyCompanionRank,
  formatCompanionRank,
  type CompanionRank,
} from "@/lib/nms/extract/companion-battle";
import { trpc } from "@/lib/trpc";
import { ScreenshotField } from "@/components/items/screenshot-field";
import { TagInput } from "@/components/items/tag-input";
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
  const [tags, setTags] = useState<string[]>([]);
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [rank, setRank] = useState<CompanionRank>(emptyCompanionRank);
  const [error, setError] = useState<string | null>(null);
  const pending = createMeta.isPending || archive.isPending;
  const adapter = getAdapter(category);

  function reset() {
    setDescription("");
    setTags([]);
    setScreenshotPath(null);
    setRank(emptyCompanionRank());
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
      const rankLabel = formatCompanionRank(rank);
      await archive.mutateAsync({
        category,
        name: item.name,
        seed: item.seed || "0x0",
        description: trimmed,
        metadata: {
          gameVersion: summary.gameVersion,
          className:
            category === "companion"
              ? rankLabel || undefined
              : item.className || undefined,
          shipType: item.itemType || undefined,
          filename: item.filename || undefined,
          extra:
            category === "companion"
              ? companionRankExtra(item.extra, rank)
              : item.extra,
          payload: item.payload,
        },
        galaxy: summary.galaxy,
        sourceSaveId: save.id,
        tags,
        screenshotPath: screenshotPath ?? undefined,
      });
      await Promise.all([
        utils.items.list.invalidate(),
        utils.items.counts.invalidate(),
        utils.items.filterOptions.invalidate(),
        utils.items.listTags.invalidate(),
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
        <DialogContent className="sm:max-w-lg">
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
          {item && isFreighterBaseSlot(item) ? (
            <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              Arquivar a nave não inclui esta construção. Guarde os dois se
              quiser o interior noutro save.
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
            <TagInput
              id={tagsId}
              value={tags}
              onChange={setTags}
              placeholder="exotic"
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Digite para ver tags já usadas.
            </p>
          </div>
          <ScreenshotField
            path={screenshotPath}
            onPathChange={setScreenshotPath}
            disabled={pending}
          />
          {category === "companion" ? (
            <CompanionRankField value={rank} onChange={setRank} disabled={pending} />
          ) : null}
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
