"use client";

import { Button } from "@/components/ui/button";
import type { SaveContext } from "@/lib/nms/player";
import { useSaveSession } from "@/stores/save-session";

const OPTIONS: { id: SaveContext; label: string }[] = [
  { id: "main", label: "Principal" },
  { id: "expedition", label: "Expedição" },
];

export function SaveContextSwitch({ disabled = false }: { disabled?: boolean }) {
  const available = useSaveSession((s) => s.expeditionAvailable);
  const current = useSaveSession((s) => s.saveContext);
  const setSaveContext = useSaveSession((s) => s.setSaveContext);
  if (!available) return null;

  return (
    <div
      className="flex rounded-lg border p-0.5"
      role="group"
      aria-label="Contexto do save"
    >
      {OPTIONS.map((option) => {
        const selected = current === option.id;
        return (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={selected ? "default" : "ghost"}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => setSaveContext(option.id)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

