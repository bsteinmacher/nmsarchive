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
        <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
      </div>
      {category === "ship" ? (
        <ShipPanel />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Fase 3</CardTitle>
            <CardDescription>
              Esta categoria entra depois do round-trip de naves.
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
