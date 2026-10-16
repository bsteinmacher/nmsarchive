"use client";

import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  autoTagsFromSlot,
  replaceClassTag,
  replaceMultitoolTypeTag,
} from "@/lib/auto-tags";
import { CompanionRankField } from "@/components/items/companion-rank-field";
import { MultitoolTypeField } from "@/components/items/multitool-type-field";
import { ScreenshotField } from "@/components/items/screenshot-field";
import { TagInput } from "@/components/items/tag-input";
import { getAdapter, isFreighterBaseSlot, type ExtractedSlot } from "@/lib/nms/extract";
import { archiveMultitoolType } from "@/lib/nms/multitool-type";
import {
  companionClassFromRank,
  companionRankExtra,
  emptyCompanionRank,
  type CompanionRank,
} from "@/lib/nms/extract/companion-battle";
import { trpc } from "@/lib/trpc";
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
  const titleId = useId();
  const notesId = useId();
  const tagsId = useId();
  const errorId = useId();
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [rank, setRank] = useState<CompanionRank>(emptyCompanionRank);
  const [shipType, setShipType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState("");
  const pending = createMeta.isPending || archive.isPending;
  const adapter = getAdapter(category);
  const itemKey = open && item ? `${item.category}:${item.index}` : "";

  function applyDefaults(slot: ExtractedSlot | null) {
    setDescription(slot?.name ?? "");
    setNotes("");
    setScreenshotPath(null);
    setRank(emptyCompanionRank());
    const nextType =
      slot?.category === "multitool"
        ? archiveMultitoolType(slot.itemType)
        : (slot?.itemType ?? "");
    setShipType(nextType);
    setTags(
      slot
        ? slot.category === "multitool"
          ? replaceMultitoolTypeTag(autoTagsFromSlot(slot), nextType)
          : autoTagsFromSlot(slot)
        : [],
    );
    setError(null);
  }

  if (itemKey !== formKey) {
    setFormKey(itemKey);
    applyDefaults(item);
  }

  function reset() {
    applyDefaults(item);
  }

  async function commit() {
    if (!item || item.empty || item.readonly) return;
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Escreva um título. Ele aparece no arquivo pessoal.");
      document.getElementById(titleId)?.focus();
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
      const className =
        category === "companion"
          ? companionClassFromRank(rank) || undefined
          : item.className || undefined;
      const typeLabel =
        category === "ship" || category === "multitool"
          ? shipType.trim() || item.itemType
          : item.itemType;
      const nextTags =
        category === "multitool"
          ? replaceMultitoolTypeTag(tags, typeLabel)
          : tags;
      await archive.mutateAsync({
        category,
        name: item.name,
        seed: item.seed || "0x0",
        description: trimmed,
        metadata: {
          gameVersion: summary.gameVersion,
          className,
          shipType: typeLabel || undefined,
          filename: item.filename || undefined,
          extra:
            category === "companion"
              ? companionRankExtra(item.extra, rank)
              : item.extra,
          notes: notes.trim() || undefined,
          payload: item.payload,
        },
        galaxy: summary.galaxy,
        sourceSaveId: save.id,
        tags: nextTags,
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
        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={onSubmit}
          noValidate
        >
        <DialogHeader>
          <DialogTitle>Arquivar {item?.name ?? adapter.label}</DialogTitle>
          <DialogDescription>
            Copia este item para o SQLite. O save.hg fica só neste browser.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {item?.warning ? (
            <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              {item.warning}
            </p>
          ) : null}
          {item && isFreighterBaseSlot(item) ? (
            <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              Arquivar a Ship não inclui esta construção. Guarde os dois se
              quiser o interior noutro save.
            </p>
          ) : null}
          {category === "exosuit" ? (
            <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              Só slots, posições de tech e supercharged. Substâncias e produtos
              do Exosuit não entram no arquivo.
            </p>
          ) : null}
          {category === "deepspace" ? (
            <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              Deep Space entra no mesmo array das bases planetárias. Não há
              limite separado no JSON.
            </p>
          ) : null}
          {category === "spacestation" ? (
            <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              O jogo aceita até 20 Space Stations por save. Aplicar a 21ª
              falha com uma mensagem clara.
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor={titleId}>Título</Label>
            <Input
              id={titleId}
              name="title"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            {error ? (
              <p id={errorId} className="text-sm text-destructive">
                {error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Obrigatório. Aparece no arquivo pessoal.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={notesId}>Descrição</Label>
            <Textarea
              id={notesId}
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Onde encontrou, o que quiser lembrar."
            />
          </div>
          {category === "ship" ? (
            <div className="grid gap-2">
              <Label htmlFor={`${tagsId}-type`}>Type</Label>
              <Input
                id={`${tagsId}-type`}
                value={shipType}
                onChange={(e) => setShipType(e.target.value)}
                placeholder="Interceptor"
              />
              <p className="text-xs text-muted-foreground">
                Detectado do filename. Interceptor e Living Ship às vezes vêm
                como Fighter — ajuste se precisar.
              </p>
            </div>
          ) : null}
          {category === "multitool" ? (
            <MultitoolTypeField
              id={`${tagsId}-type`}
              value={shipType}
              onChange={(next) => {
                setShipType(next);
                setTags((current) => replaceMultitoolTypeTag(current, next));
              }}
              disabled={pending}
            />
          ) : null}
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
            <CompanionRankField
              value={rank}
              onChange={(next) => {
                setRank(next);
                setTags((current) =>
                  replaceClassTag(current, companionClassFromRank(next)),
                );
              }}
              disabled={pending}
            />
          ) : null}
        </DialogBody>
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
