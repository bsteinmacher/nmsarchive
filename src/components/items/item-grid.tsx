"use client";

import { matchingShips } from "@/lib/archive-match";
import { formatGalaxy } from "@/lib/nms/galaxies";
import { cn } from "cn";
import type { ArchivedItemSummary } from "@/types/archive";
import { useSaveSession } from "@/stores/save-session";

export function ItemGrid({
  items,
  onSelect,
}: {
  items: ArchivedItemSummary[];
  onSelect: (id: string) => void;
}) {
  const ships = useSaveSession((s) => s.ships);
  const saveReady = useSaveSession((s) => s.status === "ready");

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const matches = saveReady
          ? matchingShips(ships, item.seed, item.category)
          : [];
        const typeLabel = item.shipType || item.category;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex h-full w-full flex-col gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10",
                "transition-colors hover:bg-muted/30",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {typeLabel}
                </span>
                {item.className ? (
                  <span className="rounded-full border px-2 py-0.5 text-xs">
                    Classe {item.className}
                  </span>
                ) : null}
                {matches.length > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    No save · slot {matches[0].index + 1}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="font-heading text-base font-medium break-words">
                  {item.name}
                </p>
                <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
                  {item.seed}
                </p>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {item.description}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {item.galaxy != null ? (
                  <span>{formatGalaxy(item.galaxy)}</span>
                ) : null}
                {item.tags.length > 0 ? (
                  <span>{item.tags.map((t) => t.label).join(" · ")}</span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
