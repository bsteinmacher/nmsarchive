"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShipPanel } from "@/components/items/ship-panel";
import { CATEGORY_META, type Category } from "@/types/nms";

export function CategoryView({ category }: { category: Category }) {
  const meta = CATEGORY_META[category];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {meta.label}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {category === "ship"
            ? "Slots do save aberto, com vazios visíveis. Arraste para reordenar. Use Arquivar para mandar uma nave ao arquivo pessoal."
            : meta.description}
        </p>
      </div>
      {category === "ship" ? (
        <ShipPanel />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {category === "exosuit" ? "Fase 3 · só layout" : "Fase 3"}
            </CardTitle>
            <CardDescription>
              {category === "exosuit"
                ? "Arquivar quantidade de slots e posição das tecnologias, se o JSON deixar separar."
                : "Esta categoria entra no save aberto e no arquivo depois das naves."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {meta.description}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
