"use client";

import { SaveCategoryPanel } from "@/components/items/save-category-panel";
import { useCategoryCopy } from "@/i18n/format";
import type { Category } from "@/types/nms";

export function CategoryView({ category }: { category: Category }) {
  const categories = useCategoryCopy();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {categories.label(category)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {categories.description(category)}
        </p>
      </div>
      <SaveCategoryPanel category={category} />
    </div>
  );
}
