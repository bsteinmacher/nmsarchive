import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Banco, backup e mapping.json — Fase 2 e 5.
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
          Backup automático e atualização do mapping entram depois do MVP.
        </CardContent>
      </Card>
    </div>
  );
}
