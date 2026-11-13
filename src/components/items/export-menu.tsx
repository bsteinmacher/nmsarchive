"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ExportMenu({
  variant,
  disabled,
  onArchive,
  onApply,
  onDownload,
}: {
  variant: "save" | "archive";
  disabled?: boolean;
  onArchive?: () => void;
  onApply?: () => void;
  onDownload: () => void;
}) {
  const t = useTranslations("common");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={<Button size="sm" variant="outline" />}
      >
        {t("export")}
        <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {variant === "save" ? (
          <DropdownMenuItem
            onClick={() => {
              onArchive?.();
            }}
          >
            {t("personalArchive")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => {
              onApply?.();
            }}
          >
            {t("applyToSave")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDownload}>{t("downloadNmsitem")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
