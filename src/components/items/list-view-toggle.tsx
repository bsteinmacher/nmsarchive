"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ArchiveView } from "@/lib/archive-url";

export function ListViewToggle({
  value,
  onChange,
}: {
  value: ArchiveView;
  onChange: (view: ArchiveView) => void;
}) {
  const t = useTranslations("common");
  return (
    <div
      role="group"
      aria-label={t("listAs")}
      className="flex gap-1 rounded-lg bg-muted/40 p-1"
    >
      <Button
        type="button"
        size="sm"
        variant={value === "grid" ? "secondary" : "ghost"}
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid aria-hidden="true" />
        {t("grid")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "table" ? "secondary" : "ghost"}
        aria-pressed={value === "table"}
        onClick={() => onChange("table")}
      >
        <List aria-hidden="true" />
        {t("table")}
      </Button>
    </div>
  );
}
