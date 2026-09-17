"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  COMPANION_RANK_LETTERS,
  type CompanionRank,
} from "@/lib/nms/extract/companion-battle";
import { cn } from "cn";

const selectClass = cn(
  "h-8 w-full min-h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
);

const FIELDS = [
  { key: "atk" as const, label: "Atk" },
  { key: "agi" as const, label: "Agi" },
  { key: "hp" as const, label: "HP" },
];

export function CompanionRankField({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: CompanionRank;
  onChange: (next: CompanionRank) => void;
  disabled?: boolean;
}) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const hintId = `${baseId}-hint`;

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">Atk / Agi / HP</legend>
      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map((field) => {
          const fieldId = `${baseId}-${field.key}`;
          return (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={fieldId}>{field.label}</Label>
              <select
                id={fieldId}
                className={selectClass}
                value={value[field.key]}
                disabled={disabled}
                aria-describedby={hintId}
                onChange={(e) =>
                  onChange({ ...value, [field.key]: e.target.value })
                }
              >
                <option value="">—</option>
                {COMPANION_RANK_LETTERS.map((letter) => (
                  <option key={letter} value={letter}>
                    {letter}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        Como no jogo. O save não guarda essas letras; o arquivo sim. Aplicar de
        volta usa o seed e o jogo mostra o rank certo.
      </p>
    </fieldset>
  );
}
