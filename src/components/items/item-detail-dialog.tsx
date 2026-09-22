"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { archiveEnvelopeCategory, archiveUiCategory, matchingSlotsForArchived, sessionCategoryForArchived } from "@/lib/archive-match";
import { formatGalaxy } from "@/lib/nms/galaxies";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import {
  buildNmsItem,
  gameVersionMismatch,
  type NmsItemFile,
} from "@/lib/nmsitem";
import { getMappedJson, useSaveSession } from "@/stores/save-session";
import { trpc } from "@/lib/trpc";
import { ItemCompare } from "@/components/items/item-compare";
import { JsonTree } from "@/components/items/json-tree";
import { ScreenshotField } from "@/components/items/screenshot-field";
import { TagInput } from "@/components/items/tag-input";
import { CompanionRankField } from "@/components/items/companion-rank-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { CATEGORY_META, isCategory } from "@/types/nms";
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
import { cn } from "cn";
import {
  companionRankExtra,
  companionRankFromMetadata,
  emptyCompanionRank,
  formatCompanionRank,
  type CompanionRank,
} from "@/lib/nms/extract/companion-battle";

export function ItemDetailDialog({
  itemId,
  open,
  onOpenChange,
}: {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const query = trpc.items.get.useQuery(
    { id: itemId ?? "" },
    { enabled: open && itemId != null },
  );
  const update = trpc.items.update.useMutation();
  const remove = trpc.items.delete.useMutation();
  const item = query.data;
  const sessionItems = useSaveSession((s) => s.items);
  const saveStatus = useSaveSession((s) => s.status);
  const importItem = useSaveSession((s) => s.importItem);
  const descriptionId = useId();
  const tagsId = useId();
  const errorId = useId();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [rank, setRank] = useState<CompanionRank>(emptyCompanionRank);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingItem, setPendingItem] = useState<NmsItemFile | null>(null);
  const [versionWarning, setVersionWarning] = useState<string | null>(null);

  if (item && item.id !== draftId) {
    setDraftId(item.id);
    setDescription(item.description);
    setTags(item.tags.map((t) => t.label));
    setScreenshotPath(item.screenshotPath);
    setRank(
      companionRankFromMetadata({
        className: item.className,
        extra: item.metadata.extra,
      }),
    );
    setError(null);
    setConfirmDelete(false);
  }
  if (!item && draftId != null) {
    setDraftId(null);
  }

  const sessionCategory = item
    ? sessionCategoryForArchived({
        category: item.category,
        shipType: item.shipType,
        extra: item.metadata.extra,
      })
    : null;
  const matches =
    item && sessionCategory
      ? matchingSlotsForArchived(sessionItems[sessionCategory], item)
      : [];
  const saveReady = saveStatus === "ready";
  const uiCategory =
    item && isCategory(item.category)
      ? archiveUiCategory({
          category: item.category,
          shipType: item.shipType,
          extra: item.metadata.extra,
        })
      : item?.category;
  const categoryLabel =
    uiCategory && isCategory(uiCategory)
      ? CATEGORY_META[uiCategory].label
      : "item";

  function toNmsItem(): NmsItemFile | null {
    if (!item) return null;
    const envelope = archiveEnvelopeCategory({
      category: item.category,
      shipType: item.shipType,
      extra: item.metadata.extra,
    });
    if (!envelope) {
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

  async function applyItem(file: NmsItemFile) {
    try {
      const index = await importItem(file);
      toast.success(`Aplicado no slot ${index + 1} do save aberto.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao aplicar");
    } finally {
      setPendingItem(null);
      setVersionWarning(null);
    }
  }

  function onApply() {
    const file = toNmsItem();
    if (!file) return;
    if (!saveReady) {
      toast.error("Abra um save para aplicar este item num slot.");
      return;
    }
    const json = getMappedJson();
    const warning = json ? gameVersionMismatch(file, json) : null;
    if (warning) {
      setPendingItem(file);
      setVersionWarning(warning);
      return;
    }
    void applyItem(file);
  }

  async function onSaveEdits(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    const trimmed = description.trim();
    if (!trimmed) {
      setError("A descrição não pode ficar vazia.");
      document.getElementById(descriptionId)?.focus();
      return;
    }
    try {
      await update.mutateAsync({
        id: item.id,
        description: trimmed,
        tags,
        screenshotPath,
        ...(item.category === "companion"
          ? {
              className: formatCompanionRank(rank) || null,
              extra: companionRankExtra(item.metadata.extra ?? {}, rank),
            }
          : {}),
      });
      await Promise.all([
        utils.items.get.invalidate({ id: item.id }),
        utils.items.list.invalidate(),
        utils.items.filterOptions.invalidate(),
        utils.items.listTags.invalidate(),
        utils.logs.list.invalidate(),
      ]);
      toast.success("Alterações salvas.");
      setError(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    }
  }

  async function onDelete() {
    if (!item) return;
    try {
      await remove.mutateAsync({ id: item.id });
      await Promise.all([
        utils.items.list.invalidate(),
        utils.items.counts.invalidate(),
        utils.logs.list.invalidate(),
      ]);
      toast.success(`${item.name} saiu do arquivo.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{item?.name ?? "Item arquivado"}</DialogTitle>
            <DialogDescription>
              {item
                ? `${item.shipType || categoryLabel} · ${item.seed}`
                : "Carregando do arquivo pessoal."}
            </DialogDescription>
          </DialogHeader>

          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando item…</p>
          ) : query.error ? (
            <p className="text-sm text-destructive">
              {query.error.message}
            </p>
          ) : item ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {item.className ? <span>Class {item.className}</span> : null}
                {item.galaxy != null ? (
                  <span>{formatGalaxy(item.galaxy)}</span>
                ) : null}
                {item.filename ? (
                  <span className="font-mono text-xs break-all">
                    {item.filename}
                  </span>
                ) : null}
              </div>

              {saveReady ? (
                <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  {matches.length > 0
                    ? `Mesmo seed no save aberto: slot ${matches.map((s) => s.slotLabel ?? s.index + 1).join(", ")}.`
                    : uiCategory === "spacestation"
                      ? "Não há item com este seed no save aberto. Aplicar usa o primeiro slot vazio deste tipo, ou acrescenta no fim — e recusa se já houver 20 Space Stations."
                      : uiCategory === "deepspace"
                        ? "Não há item com este seed no save aberto. Aplicar usa o primeiro slot vazio deste tipo, ou acrescenta no fim do array de bases."
                        : "Não há item com este seed no save aberto. Aplicar usa o primeiro slot vazio (ou substitui o mesmo seed se o array estiver cheio)."}
                </p>
              ) : (
                <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  Sem save aberto.{" "}
                  <Link href="/save" className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}>
                    Abrir um save
                  </Link>{" "}
                  para aplicar este item.
                </p>
              )}

              <ScreenshotField
                path={screenshotPath}
                onPathChange={setScreenshotPath}
                disabled={update.isPending}
              />

              {saveReady && matches[0] ? (
                <ItemCompare
                  archived={{
                    seed: item.seed,
                    className: item.className,
                    itemType: item.shipType,
                    payload: item.payload,
                  }}
                  save={{
                    seed: matches[0].seed,
                    className: matches[0].className,
                    itemType: matches[0].itemType,
                    payload: matches[0].payload,
                  }}
                  saveLabel={`slot ${matches[0].slotLabel ?? matches[0].index + 1}`}
                />
              ) : null}

              <form className="grid gap-3" onSubmit={onSaveEdits} noValidate>
                <div className="grid gap-2">
                  <Label htmlFor={descriptionId}>Descrição</Label>
                  <Textarea
                    id={descriptionId}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                  />
                  {error ? (
                    <p id={errorId} className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={tagsId}>Tags</Label>
                  <TagInput
                    id={tagsId}
                    value={tags}
                    onChange={setTags}
                    placeholder="exotic"
                  />
                </div>
                {item.category === "companion" ? (
                  <CompanionRankField
                    value={rank}
                    onChange={setRank}
                    disabled={update.isPending}
                  />
                ) : null}
                <div>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={update.isPending}
                  >
                    {update.isPending ? "Salvando…" : "Salvar alterações"}
                  </Button>
                </div>
              </form>

              {item.payload != null ? <JsonTree value={item.payload} /> : null}

              {confirmDelete ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-sm">
                    Excluir {item.name} do arquivo? Esta ação não desfaz o save
                    aberto.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void onDelete()}
                      disabled={remove.isPending}
                    >
                      {remove.isPending ? "Excluindo…" : "Excluir item"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={!item || confirmDelete}
            >
              Excluir
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const file = toNmsItem();
                if (!file) return;
                downloadNmsItemFile(file);
                toast.success("Exportado .nmsitem");
              }}
              disabled={!item}
            >
              Exportar .nmsitem
            </Button>
            <Button type="button" onClick={onApply} disabled={!item}>
              Aplicar no save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingItem != null}
        onOpenChange={(next) => {
          if (!next) {
            setPendingItem(null);
            setVersionWarning(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Versões diferentes</DialogTitle>
            <DialogDescription>
              {versionWarning} O apply não é bloqueado, mas o jogo pode ignorar
              campos novos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingItem(null);
                setVersionWarning(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pendingItem) void applyItem(pendingItem);
              }}
            >
              Aplicar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
