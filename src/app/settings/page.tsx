"use client";

import { useRef, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatOperationLabel } from "@/lib/operation-labels";
import { trpc } from "@/lib/trpc";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatWhen(iso: string | Date) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const settings = trpc.settings.get.useQuery();
  const logs = trpc.logs.list.useQuery({ limit: 40 });
  const backup = trpc.settings.backup.useMutation();
  const restore = trpc.settings.restore.useMutation();
  const restoreUpload = trpc.settings.restoreUpload.useMutation();
  const updateMapping = trpc.settings.updateMapping.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function refreshAll() {
    await Promise.all([
      utils.settings.get.invalidate(),
      utils.logs.list.invalidate(),
    ]);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Caminho do banco, backups do SQLite e atualização do mapping.json. O
          save aberto não passa por aqui.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Banco local</CardTitle>
          <CardDescription>
            SQLite do arquivo pessoal. Informativo — o path não muda nesta fase.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">DATABASE_URL · </span>
            <code>{settings.data?.databaseUrl ?? "…"}</code>
          </p>
          <p>
            <span className="text-muted-foreground">Arquivo · </span>
            <code className="break-all">
              {settings.data?.databasePath ?? "…"}
            </code>
            {settings.data?.databaseSize != null
              ? ` · ${formatBytes(settings.data.databaseSize)}`
              : null}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup e restore</CardTitle>
          <CardDescription>
            Cópia em <code>data/backups/</code> antes de arquivar. Guardamos as
            20 mais recentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                void (async () => {
                  try {
                    const result = await backup.mutateAsync();
                    toast.success(`Backup ${result.fileName}`);
                    await refreshAll();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Falha no backup",
                    );
                  }
                })();
              }}
              disabled={backup.isPending}
            >
              {backup.isPending ? "Copiando…" : "Fazer backup agora"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={restoreUpload.isPending || busy}
            >
              Restaurar .db…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".db,application/octet-stream"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void (async () => {
                  setBusy(true);
                  try {
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    await restoreUpload.mutateAsync({
                      bytes,
                      fileName: file.name,
                    });
                    toast.success(
                      "Banco restaurado. Recarregue a página para ver os itens.",
                    );
                    window.location.reload();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Falha no restore",
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </div>
          {settings.data?.backups.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.data.backups.map((row) => (
                  <TableRow key={row.fileName}>
                    <TableCell className="font-mono text-xs">
                      {row.fileName}
                    </TableCell>
                    <TableCell>{formatBytes(row.size)}</TableCell>
                    <TableCell>{formatWhen(row.mtime)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            try {
                              await restore.mutateAsync({
                                fileName: row.fileName,
                              });
                              toast.success(
                                `Restaurado ${row.fileName}. Recarregue a página.`,
                              );
                              window.location.reload();
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Falha no restore",
                              );
                            }
                          })();
                        }}
                        disabled={restore.isPending}
                      >
                        Restaurar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum backup ainda. Arquivar uma nave cria o primeiro.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>mapping.json</CardTitle>
          <CardDescription>
            Cache em <code>data/mapping.json</code>, baixado do MBINCompiler.
            Depois de atualizar, abra o save de novo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            libMBIN {settings.data?.mappingVersion ?? "carregando…"}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void (async () => {
                try {
                  const result = await updateMapping.mutateAsync();
                  toast.success(
                    `mapping.json ${result.libMBIN_version}. Abra o save de novo para aplicar.`,
                  );
                  await refreshAll();
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Falha ao atualizar mapping",
                  );
                }
              })();
            }}
            disabled={updateMapping.isPending}
          >
            {updateMapping.isPending
              ? "Baixando…"
              : "Atualizar mapping.json"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log de operações</CardTitle>
          <CardDescription>
            Archive, backup, restore e atualização de mapping.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !logs.data?.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma operação registrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ação</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatOperationLabel(row.action)}</TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {row.item?.name ??
                        (row.detail &&
                        typeof row.detail === "object" &&
                        "fileName" in row.detail &&
                        typeof row.detail.fileName === "string"
                          ? row.detail.fileName
                          : "—")}
                    </TableCell>
                    <TableCell>{formatWhen(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
