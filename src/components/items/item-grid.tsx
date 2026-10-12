"use client";

import { archiveUiCategory, matchingSlotsForArchived, sessionCategoryForArchived } from "@/lib/archive-match";
import { screenshotPublicUrl } from "@/lib/screenshots";
import { cn } from "cn";
import {
  archiveColumnValue,
  dataColumns,
} from "@/lib/list-columns";
import type { ArchivedItemSummary } from "@/types/archive";
import { isCategory, type Category } from "@/types/nms";
import { useSaveSession } from "@/stores/save-session";

export function ItemGrid({
  items,
  category,
  onSelect,
}: {
  items: ArchivedItemSummary[];
  category?: Category;
  onSelect: (id: string) => void;
}) {
  const sessionItems = useSaveSession((s) => s.items);
  const saveReady = useSaveSession((s) => s.status === "ready");

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const uiCategory = archiveUiCategory(item);
        const sessionCategory = sessionCategoryForArchived(item);
        const slots =
          saveReady && sessionCategory
            ? matchingSlotsForArchived(
                sessionItems[sessionCategory],
                item,
              )
            : [];
        const thumb = screenshotPublicUrl(item.screenshotPath);
        const columnCategory =
          category ?? (isCategory(uiCategory) ? uiCategory : undefined);
        const meta = (columnCategory ? dataColumns(columnCategory) : [])
          .map((col) => {
            const value = archiveColumnValue(item, col);
            return value ? `${col.header} ${value}` : null;
          })
          .filter(Boolean);
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex h-full min-h-11 w-full flex-col gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10",
                "transition-colors hover:bg-muted/30",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              )}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt=""
                  className="aspect-video w-full rounded-lg object-cover outline outline-1 outline-[oklch(0_0_0_/_0.1)] dark:outline-[oklch(1_0_0_/_0.1)]"
                />
              ) : (
                <div
                  className="aspect-video w-full rounded-lg bg-muted/40"
                  aria-hidden="true"
                />
              )}
              {slots.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    No save · slot {slots[0].slotLabel ?? slots[0].index + 1}
                  </span>
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="font-heading text-base font-medium break-words">
                  {item.name}
                </p>
                {meta.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {meta.join(" · ")}
                  </p>
                ) : null}
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {item.description}
              </p>
              {item.tags.length > 0 ? (
                <p className="mt-auto text-xs text-muted-foreground">
                  {item.tags.map((t) => t.label).join(" · ")}
                </p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
