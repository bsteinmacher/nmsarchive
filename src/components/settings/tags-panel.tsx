"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CollapsibleCard } from "@/components/layout/collapsible-card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { tagLabelSchema } from "@/lib/validations";

type TagRow = {
  id: string;
  slug: string;
  label: string;
  itemCount: number;
};

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function TagsPanel() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const utils = trpc.useUtils();
  const tags = trpc.items.listAllTags.useQuery();
  const create = trpc.items.createTag.useMutation();
  const update = trpc.items.updateTag.useMutation();
  const remove = trpc.items.deleteTag.useMutation();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TagRow | null>(null);

  const filtered = useMemo(() => {
    const rows = tags.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.label.toLowerCase().includes(needle) ||
        row.slug.includes(needle),
    );
  }, [tags.data, query]);

  async function refreshTags() {
    await Promise.all([
      utils.items.listAllTags.invalidate(),
      utils.items.listTags.invalidate(),
      utils.items.list.invalidate(),
      utils.items.filterOptions.invalidate(),
      utils.logs.list.invalidate(),
    ]);
  }

  async function onCreate() {
    const parsed = tagLabelSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("invalidTag"));
      return;
    }
    try {
      await create.mutateAsync({ label: parsed.data });
      setDraft("");
      toast.success(t("tagCreated", { label: parsed.data }));
      await refreshTags();
    } catch (err) {
      toast.error(errorMessage(err, t("tagCreateFailed")));
    }
  }

  function startEdit(row: TagRow) {
    setEditingId(row.id);
    setEditLabel(row.label);
  }

  async function saveEdit(row: TagRow) {
    const parsed = tagLabelSchema.safeParse(editLabel);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("invalidTag"));
      return;
    }
    if (parsed.data === row.label) {
      setEditingId(null);
      return;
    }
    try {
      await update.mutateAsync({ id: row.id, label: parsed.data });
      setEditingId(null);
      toast.success(t("tagUpdated", { label: parsed.data }));
      await refreshTags();
    } catch (err) {
      toast.error(errorMessage(err, t("tagUpdateFailed")));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync({ id: pendingDelete.id });
      toast.success(t("tagDeleted", { label: pendingDelete.label }));
      setPendingDelete(null);
      if (editingId === pendingDelete.id) setEditingId(null);
      await refreshTags();
    } catch (err) {
      toast.error(errorMessage(err, t("tagDeleteFailed")));
    }
  }

  return (
    <>
      <CollapsibleCard
        title={t("tagsTitle")}
        description={t("tagsDescription")}
        expandLabel={t("tagsExpand")}
        collapseLabel={t("tagsCollapse")}
        contentClassName="grid gap-4"
      >
          <form
            className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="settings-tag-new">{t("newTag")}</Label>
              <Input
                id="settings-tag-new"
                value={draft}
                maxLength={40}
                placeholder={t("tagPlaceholder")}
                autoComplete="off"
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={create.isPending || !draft.trim()}>
              {create.isPending ? common("creating") : common("create")}
            </Button>
          </form>

          <div className="grid gap-1.5">
            <Label htmlFor="settings-tag-q">{common("search")}</Label>
            <Input
              id="settings-tag-q"
              type="search"
              value={query}
              placeholder={t("searchPlaceholder")}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {tags.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("loadingTags")}</p>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground">
              {tags.data?.length ? t("noTagsFilter") : t("noTags")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tag")}</TableHead>
                  <TableHead>{t("slug")}</TableHead>
                  <TableHead>{t("items")}</TableHead>
                  <TableHead className="text-right">{common("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const editing = editingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        {editing ? (
                          <Input
                            value={editLabel}
                            maxLength={40}
                            autoComplete="off"
                            aria-label={t("renameTag", { label: row.label })}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void saveEdit(row);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                setEditingId(null);
                              }
                            }}
                          />
                        ) : (
                          row.label
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.slug}
                      </TableCell>
                      <TableCell>{row.itemCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {editing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                                disabled={update.isPending}
                              >
                                {common("cancel")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void saveEdit(row)}
                                disabled={update.isPending || !editLabel.trim()}
                              >
                                {update.isPending ? common("saving") : common("save")}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={common("editNamed", { label: row.label })}
                                onClick={() => startEdit(row)}
                              >
                                <Pencil aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={common("deleteNamed", { label: row.label })}
                                onClick={() => setPendingDelete(row)}
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
      </CollapsibleCard>

      <Dialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setPendingDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("deleteTagTitle")}</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? pendingDelete.itemCount > 0
                  ? t("deleteTagUsed", {
                      label: pendingDelete.label,
                      count: pendingDelete.itemCount,
                    })
                  : t("deleteTagUnused", { label: pendingDelete.label })
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              {t("deleteTagBody")}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={remove.isPending}
            >
              {common("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={remove.isPending}
            >
              {remove.isPending ? common("deleting") : t("deleteTagConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
