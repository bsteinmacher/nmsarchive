"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive } from "lucide-react";
import { cn } from "cn";
import { ItemDetailDialog } from "@/components/items/item-detail-dialog";
import { ItemGrid } from "@/components/items/item-grid";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatOperationLabel } from "@/lib/operation-labels";
import { trpc } from "@/lib/trpc";
import {
  archiveHref,
  CATEGORIES,
  CATEGORY_META,
  type Category,
} from "@/types/nms";

function formatWhen(date: Date) {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArchiveHome({ category }: { category?: Category }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = trpc.items.list.useQuery(
    category ? { category } : {},
  );
  const counts = trpc.items.counts.useQuery();
  const logs = trpc.logs.list.useQuery({ limit: 8 });
  const items = list.data?.items ?? [];
  const totalAll = Object.values(counts.data ?? {}).reduce((a, b) => a + b, 0);
  const phase3 = category != null && category !== "ship";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Arquivo pessoal
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          O que você guarda fica aqui, mesmo depois de fechar o browser. O save
          aberto só copia de/para este arquivo.
        </p>
      </div>

      <nav aria-label="Filtrar por categoria" className="flex flex-wrap gap-2">
        <Link
          href="/"
          className={cn(
            buttonVariants({
              variant: category == null ? "default" : "outline",
              size: "sm",
            }),
          )}
        >
          Todas{totalAll ? ` (${totalAll})` : ""}
        </Link>
        {CATEGORIES.map((slug) => {
          const meta = CATEGORY_META[slug];
          const count = counts.data?.[slug] ?? 0;
          const active = category === slug;
          return (
            <Link
              key={slug}
              href={archiveHref(slug)}
              className={cn(
                buttonVariants({
                  variant: active ? "default" : "outline",
                  size: "sm",
                }),
              )}
            >
              {meta.label}
              {count ? ` (${count})` : ""}
            </Link>
          );
        })}
      </nav>

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando arquivo…</p>
      ) : list.error ? (
        <p className="text-sm text-destructive">{list.error.message}</p>
      ) : phase3 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {CATEGORY_META[category].label} entram na Fase 3
            </CardTitle>
            <CardDescription>
              Por enquanto só naves vão para o arquivo. As outras categorias já
              aparecem na navegação para não misturar com o save aberto.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Archive
                className="mt-0.5 size-5 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <CardTitle>Nada arquivado ainda</CardTitle>
                <CardDescription>
                  Abra um save e, na nave, use Arquivar com uma descrição. As
                  três (ou trezentas) ficam nesta home depois de um restart.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/save" className={cn(buttonVariants())}>
              Abrir um save
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ItemGrid items={items} onSelect={setSelectedId} />
      )}

      <section className="grid gap-3" aria-labelledby="activity-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="activity-heading"
            className="font-heading text-sm font-medium"
          >
            Atividade recente
          </h2>
          <Link
            href="/settings"
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "h-auto p-0",
            )}
          >
            Ver em Configurações
          </Link>
        </div>
        {logs.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando log…</p>
        ) : !logs.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há operações no banco.
          </p>
        ) : (
          <ol className="grid gap-2">
            {logs.data.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {formatOperationLabel(row.action)}
                  </span>
                  {row.item?.name ? ` · ${row.item.name}` : null}
                  {!row.item?.name &&
                  row.detail &&
                  typeof row.detail === "object" &&
                  "fileName" in row.detail &&
                  typeof row.detail.fileName === "string"
                    ? ` · ${row.detail.fileName}`
                    : null}
                </span>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={row.createdAt.toISOString()}
                >
                  {formatWhen(row.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <ItemDetailDialog
        itemId={selectedId}
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}
