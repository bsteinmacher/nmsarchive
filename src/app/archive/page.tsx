import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ArchivePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Arquivo pessoal
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Itens exportados do save. Implementação na Fase 2.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Vazio por enquanto</CardTitle>
          <CardDescription>
            O SQLite já existe. A listagem e o arquivar entram na Fase 2.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nenhum item arquivado.
        </CardContent>
      </Card>
    </div>
  );
}
