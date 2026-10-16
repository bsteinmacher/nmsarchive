"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      toast.error(parsed.error.issues[0]?.message ?? "Tag inválida.");
      return;
    }
    try {
      await create.mutateAsync({ label: parsed.data });
      setDraft("");
      toast.success(`Tag ${parsed.data} criada.`);
      await refreshTags();
    } catch (err) {
      toast.error(errorMessage(err, "Falha ao criar tag"));
    }
  }

  function startEdit(row: TagRow) {
    setEditingId(row.id);
    setEditLabel(row.label);
  }

  async function saveEdit(row: TagRow) {
    const parsed = tagLabelSchema.safeParse(editLabel);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Tag inválida.");
      return;
    }
    if (parsed.data === row.label) {
      setEditingId(null);
      return;
    }
    try {
      await update.mutateAsync({ id: row.id, label: parsed.data });
      setEditingId(null);
      toast.success(`Tag atualizada para ${parsed.data}.`);
      await refreshTags();
    } catch (err) {
      toast.error(errorMessage(err, "Falha ao atualizar tag"));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync({ id: pendingDelete.id });
      toast.success(`Tag ${pendingDelete.label} excluída.`);
      setPendingDelete(null);
      if (editingId === pendingDelete.id) setEditingId(null);
      await refreshTags();
    } catch (err) {
      toast.error(errorMessage(err, "Falha ao excluir tag"));
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Criar, renomear ou excluir tags do arquivo. Excluir tira a tag de
            todos os itens.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="settings-tag-new">Nova tag</Label>
              <Input
                id="settings-tag-new"
                value={draft}
                maxLength={40}
                placeholder="Toxic"
                autoComplete="off"
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={create.isPending || !draft.trim()}>
              {create.isPending ? "Criando…" : "Criar"}
            </Button>
          </form>

          <div className="grid gap-1.5">
            <Label htmlFor="settings-tag-q">Buscar</Label>
            <Input
              id="settings-tag-q"
              type="search"
              value={query}
              placeholder="Nome ou slug"
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {tags.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando tags…</p>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground">
              {tags.data?.length
                ? "Nenhuma tag com esse filtro."
                : "Nenhuma tag ainda."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                            aria-label={`Novo nome de ${row.label}`}
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
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void saveEdit(row)}
                                disabled={update.isPending || !editLabel.trim()}
                              >
                                {update.isPending ? "Salvando…" : "Salvar"}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Editar ${row.label}`}
                                onClick={() => startEdit(row)}
                              >
                                <Pencil aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Excluir ${row.label}`}
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
        </CardContent>
      </Card>

      <Dialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setPendingDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir tag</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? pendingDelete.itemCount > 0
                  ? `A tag ${pendingDelete.label} sai de ${pendingDelete.itemCount} ${pendingDelete.itemCount === 1 ? "item" : "itens"}.`
                  : `A tag ${pendingDelete.label} não está em nenhum item.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Isso não apaga os itens, só remove a tag deles.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={remove.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Excluindo…" : "Excluir tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
