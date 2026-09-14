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
          Aqui ficam as descobertas que você guarda. O save aberto só serve para
          copiar de/para este arquivo (Fase 2).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ainda vazio</CardTitle>
          <CardDescription>
            Na Fase 2 esta é a home: lista por categoria (naves, MTs, pets…).
            Inventário de itens não entra. Traje só como layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nenhum item arquivado.
        </CardContent>
      </Card>
    </div>
  );
}
