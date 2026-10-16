"use client";

import { ChevronDown } from "lucide-react";
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={<Button size="sm" variant="outline" />}
      >
        Exportar
        <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {variant === "save" ? (
          <DropdownMenuItem
            onClick={() => {
              onArchive?.();
            }}
          >
            Personal Archive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => {
              onApply?.();
            }}
          >
            Aplicar no save
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDownload}>Baixar .nmsitem</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
