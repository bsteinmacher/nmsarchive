"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExtractedSlot } from "@/lib/nms/extract/types";
import {
  frigateTraitIds,
  sumFrigateStats,
} from "@/lib/nms/extract/frigate-stats";

export function FrigateCalculator({ items }: { items: ExtractedSlot[] }) {
  const filled = items.filter((item) => !item.empty && !item.readonly);
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const selected = filled.filter((item) => picked.has(item.index));
  const totals = sumFrigateStats(selected.map((item) => item.payload));
  const traits = selected.flatMap((item) => frigateTraitIds(item.payload));

  if (filled.length === 0) return null;

  function toggle(index: number) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadora de expedição</CardTitle>
        <CardDescription>
          Some as stats brutas das fragatas escolhidas. Traits aparecem como
          IDs — sem bônus numérico nesta versão.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-2 sm:grid-cols-2">
          {filled.map((item) => (
            <li key={item.index}>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.has(item.index)}
                  onChange={() => toggle(item.index)}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[item.itemType, item.className].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Combat</TableHead>
              <TableHead>Exploration</TableHead>
              <TableHead>Mining</TableHead>
              <TableHead>Diplomacy</TableHead>
              <TableHead>Fuel burn</TableHead>
              <TableHead>Fuel cap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{totals.combat}</TableCell>
              <TableCell>{totals.exploration}</TableCell>
              <TableCell>{totals.mining}</TableCell>
              <TableCell>{totals.diplomacy}</TableCell>
              <TableCell>{totals.fuelBurn}</TableCell>
              <TableCell>{totals.fuelCapacity}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {traits.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Traits: {traits.join(", ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma fragata escolhida, ou sem TraitIDs.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
