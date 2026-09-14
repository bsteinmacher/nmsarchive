"use client";

import { Upload } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function HomePage() {
  const health = trpc.health.useQuery();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Carregue um save na Fase 1. Por enquanto isto só confirma o scaffold.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carregar save</CardTitle>
          <CardDescription>
            O arquivo <code>.hg</code> fica no browser. Nada é enviado ao
            servidor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            <Upload className="size-6" />
            <p>Upload de save.hg chega na Fase 1.</p>
            <p className="text-xs">
              Fixture local: <code>.others/save2.hg</code> (gitignored)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status da Fase 0</CardTitle>
          <CardDescription>Prisma + tRPC + SQLite</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {health.isLoading ? (
            <p className="text-muted-foreground">Checando API…</p>
          ) : health.error ? (
            <p className="text-destructive">
              tRPC indisponível: {health.error.message}
            </p>
          ) : health.data ? (
            <ul className="space-y-1 text-muted-foreground">
              <li>serviço: {health.data.service}</li>
              <li>fase: {health.data.phase}</li>
              <li>banco: {health.data.database}</li>
              <li>saves arquivados: {health.data.saves}</li>
              <li>itens arquivados: {health.data.items}</li>
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
