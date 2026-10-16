"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  archiveUiCategory,
  matchingSlotsForArchived,
  sessionCategoryForArchived,
} from "@/lib/archive-match";
import { archivedToNmsItem } from "@/lib/archive-export";
import {
  autoTagsFromArchived,
  mergeAutoTags,
  replaceClassTag,
  replaceMultitoolTypeTag,
} from "@/lib/auto-tags";
import { formatGalaxy } from "@/lib/nms/galaxies";
import { archiveMultitoolType } from "@/lib/nms/multitool-type";
import { downloadNmsItemFile } from "@/lib/nmsitem-zip";
import { gameVersionMismatch, type NmsItemFile } from "@/lib/nmsitem";
import { getMappedJson, useSaveSession } from "@/stores/save-session";
import { trpc } from "@/lib/trpc";
import { ItemCompare } from "@/components/items/item-compare";
import { ItemTags } from "@/components/items/item-tags";
import { JsonTree } from "@/components/items/json-tree";
import { ScreenshotField } from "@/components/items/screenshot-field";
import { TagInput } from "@/components/items/tag-input";
import { CompanionRankField } from "@/components/items/companion-rank-field";
import { MultitoolTypeField } from "@/components/items/multitool-type-field";
import { ApplyToSaveDialog } from "@/components/items/apply-to-save-dialog";
import { ConfirmDeleteDialog } from "@/components/items/confirm-delete-dialog";
import { VersionMismatchDialog } from "@/components/items/version-mismatch-dialog";
import { usesApplyDepth } from "@/lib/nms/extract/apply-depth";
import { Button, buttonVariants } from "@/components/ui/button";
import { CATEGORY_META, isCategory } from "@/types/nms";
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
import { cn } from "cn";
import {
  companionClassFromRank,
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
  const titleId = useId();
  const notesId = useId();
  const tagsId = useId();
  const errorId = useId();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [rank, setRank] = useState<CompanionRank>(emptyCompanionRank);
  const [toolType, setToolType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingItem, setPendingItem] = useState<NmsItemFile | null>(null);
  const [versionWarning, setVersionWarning] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  function loadDraft() {
    if (!item) return;
    setDescription(item.description);
    setNotes(item.notes);
    setTags(item.tags.map((t) => t.label));
    setScreenshotPath(item.screenshotPath);
    setRank(
      companionRankFromMetadata({
        className: item.className,
        extra: item.metadata.extra,
      }),
    );
    setToolType(
      item.category === "multitool"
        ? archiveMultitoolType(item.shipType)
        : item.shipType,
    );
    setError(null);
  }

  if (item && item.id !== draftId) {
    setDraftId(item.id);
    setEditing(false);
    setConfirmDelete(false);
    setDescription(item.description);
    setNotes(item.notes);
    setTags(item.tags.map((t) => t.label));
    setScreenshotPath(item.screenshotPath);
    setRank(
      companionRankFromMetadata({
        className: item.className,
        extra: item.metadata.extra,
      }),
    );
    setToolType(
      item.category === "multitool"
        ? archiveMultitoolType(item.shipType)
        : item.shipType,
    );
    setError(null);
  }
  if (!item && draftId != null) {
    setDraftId(null);
    setEditing(false);
  }
  if (!open && (editing || confirmDelete || applyOpen)) {
    setEditing(false);
    setConfirmDelete(false);
    setApplyOpen(false);
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
    return archivedToNmsItem(item);
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
    if (usesApplyDepth(file.category)) {
      setApplyOpen(true);
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

  function startEdit() {
    if (!item) return;
    setEditing(true);
    setConfirmDelete(false);
    const nextType =
      item.category === "multitool"
        ? archiveMultitoolType(item.shipType)
        : item.shipType;
    setToolType(nextType);
    const merged = mergeAutoTags(
      item.tags.map((t) => t.label),
      autoTagsFromArchived(item),
    );
    setTags(
      item.category === "multitool"
        ? replaceMultitoolTypeTag(merged, nextType)
        : merged,
    );
  }

  function cancelEdit() {
    loadDraft();
    setEditing(false);
  }

  async function commitEdits() {
    if (!item) return;
    const trimmed = description.trim();
    if (!trimmed) {
      setError("O título não pode ficar vazio.");
      document.getElementById(titleId)?.focus();
      return;
    }
    const className = companionClassFromRank(rank);
    const nextType =
      item.category === "multitool"
        ? toolType.trim() || item.shipType
        : item.shipType;
    const nextTags =
      item.category === "companion"
        ? replaceClassTag(tags, className)
        : item.category === "multitool"
          ? replaceMultitoolTypeTag(tags, nextType)
          : tags;
    try {
      await update.mutateAsync({
        id: item.id,
        description: trimmed,
        notes: notes.trim(),
        tags: nextTags,
        screenshotPath,
        ...(item.category === "companion"
          ? {
              className: className || null,
              extra: companionRankExtra(item.metadata.extra ?? {}, rank),
            }
          : {}),
        ...(item.category === "multitool"
          ? { shipType: nextType || null }
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
      setTags(nextTags);
      setError(null);
      setEditing(false);
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

  const title = item
    ? item.description.trim() || item.name
    : "Item arquivado";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && confirmDelete) {
            setConfirmDelete(false);
            return;
          }
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {item
                ? `${item.shipType || categoryLabel} · ${item.seed}`
                : "Carregando do arquivo pessoal."}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-4">
            {query.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando item…</p>
            ) : query.error ? (
              <p className="text-sm text-destructive">{query.error.message}</p>
            ) : item ? (
              <form
                className="grid gap-4"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void commitEdits();
                }}
                noValidate
              >
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {item.className ? <span>Class {item.className}</span> : null}
                  {item.extra?.element ? <span>{item.extra.element}</span> : null}
                  {item.extra?.biome ? (
                    <span>Biome {item.extra.biome}</span>
                  ) : null}
                  {item.galaxy != null && item.category === "base" ? (
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
                          : item && usesApplyDepth(item.category)
                            ? "Não há item com este seed no save aberto. Aplicar pergunta se cria num slot vazio ou se coloca em cima de uma existente."
                            : "Não há item com este seed no save aberto. Aplicar usa o primeiro slot vazio (ou substitui o mesmo seed se o array estiver cheio)."}
                  </p>
                ) : (
                  <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                    Sem save aberto.{" "}
                    <Link
                      href="/save"
                      className={cn(
                        buttonVariants({ variant: "link" }),
                        "h-auto p-0",
                      )}
                    >
                      Abrir um save
                    </Link>{" "}
                    para aplicar este item.
                  </p>
                )}

                <ScreenshotField
                  path={screenshotPath}
                  onPathChange={setScreenshotPath}
                  disabled={!editing || update.isPending}
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

                {editing ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor={titleId}>Título</Label>
                      <Input
                        id={titleId}
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
                      <Label htmlFor={notesId}>Descrição</Label>
                      <Textarea
                        id={notesId}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    {item.category === "multitool" ? (
                      <MultitoolTypeField
                        id={`${tagsId}-type`}
                        value={toolType}
                        onChange={(next) => {
                          setToolType(next);
                          setTags((current) =>
                            replaceMultitoolTypeTag(current, next),
                          );
                        }}
                        disabled={update.isPending}
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
                    </div>
                    {item.category === "companion" ? (
                      <CompanionRankField
                        value={rank}
                        onChange={(next) => {
                          setRank(next);
                          setTags((current) =>
                            replaceClassTag(
                              current,
                              companionClassFromRank(next),
                            ),
                          );
                        }}
                        disabled={update.isPending}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    {item.notes.trim() ? (
                      <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
                    ) : null}
                    <ItemTags tags={item.tags.map((t) => t.label)} />
                    {item.category === "companion" && formatCompanionRank(rank) ? (
                      <p className="text-sm text-muted-foreground">
                        Rank {formatCompanionRank(rank)}
                      </p>
                    ) : null}
                  </>
                )}

                {item.payload != null ? <JsonTree value={item.payload} /> : null}
              </form>
            ) : null}
          </DialogBody>

          <DialogFooter className={editing ? undefined : "sm:justify-between"}>
            {editing ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={update.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void commitEdits()}
                  disabled={!item || update.isPending}
                >
                  {update.isPending ? "Salvando…" : "Salvar edição"}
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  disabled={!item}
                >
                  Excluir
                </Button>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startEdit}
                    disabled={!item}
                  >
                    Editar
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
                </div>
              </>
            )}
          </DialogFooter>
          <ConfirmDeleteDialog
            open={confirmDelete && item != null}
            title={item ? `Excluir ${item.name}?` : "Excluir item?"}
            description="Esta ação tira o item do arquivo pessoal. O save aberto não muda."
            confirmLabel="Excluir item"
            pending={remove.isPending}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => void onDelete()}
          />
        </DialogContent>
      </Dialog>

      <VersionMismatchDialog
        open={pendingItem != null}
        warning={versionWarning}
        onCancel={() => {
          setPendingItem(null);
          setVersionWarning(null);
        }}
        onConfirm={() => {
          if (pendingItem) void applyItem(pendingItem);
        }}
      />
      <ApplyToSaveDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        sourceFile={applyOpen ? toNmsItem() : null}
        onApplied={() => onOpenChange(false)}
      />
    </>
  );
}
