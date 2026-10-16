"use client";

import { Label } from "@/components/ui/label";
import { isMultitoolType, MULTITOOL_TYPES } from "@/lib/nms/multitool-type";
import { cn } from "cn";

const selectClass = cn(
  "h-8 w-full min-h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
);

export function MultitoolTypeField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (type: string) => void;
  disabled?: boolean;
}) {
  const extra = value && !isMultitoolType(value) ? value : null;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Type</Label>
      <select
        id={id}
        className={selectClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Escolha o tipo</option>
        {MULTITOOL_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
        {extra ? <option value={extra}>{extra}</option> : null}
      </select>
      <p className="text-xs text-muted-foreground">
        Sentinel, Atlantid, Exotic / Royal e Voltaic Staff vêm do filename.
        Pistol, Rifle, Experimental e Alien você escolhe.
      </p>
    </div>
  );
}
