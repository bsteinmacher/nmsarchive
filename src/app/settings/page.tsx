"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  const [mappingVersion, setMappingVersion] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/mapping");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { libMBIN_version?: string };
        setMappingVersion(json.libMBIN_version ?? "desconhecida");
      } catch (err) {
        setMappingError(
          err instanceof Error ? err.message : "falha ao ler mapping",
        );
      }
    })();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Banco, backup e atualização de mapping entram na Fase 2 / 5.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Banco local</CardTitle>
          <CardDescription>
            SQLite em <code>data/nmsarchive.db</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Arquivo pessoal (tRPC items/saves) é a Fase 2. O save aberto não
          passa por aqui.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>mapping.json</CardTitle>
          <CardDescription>
            Cache em <code>data/mapping.json</code>, baixado do MBINCompiler.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {mappingError ? (
            <p className="text-destructive">{mappingError}</p>
          ) : (
            <p className="text-muted-foreground">
              libMBIN {mappingVersion ?? "carregando…"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
