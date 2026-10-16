"use client";

import { matchingSlotsForArchived, sessionCategoryForArchived } from "@/lib/archive-match";
import { screenshotPublicUrl } from "@/lib/screenshots";
import type { ArchivedItemSummary } from "@/types/archive";
import { useSaveSession } from "@/stores/save-session";
import { ArchiveItemActions } from "./archive-item-actions";
import { CardOpenTarget } from "./card-open-target";
import { ItemTags } from "./item-tags";

export function ItemGrid({
  items,
  onSelect,
}: {
  items: ArchivedItemSummary[];
  onSelect: (id: string) => void;
}) {
  const sessionItems = useSaveSession((s) => s.items);
  const saveReady = useSaveSession((s) => s.status === "ready");

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const sessionCategory = sessionCategoryForArchived(item);
        const slots =
          saveReady && sessionCategory
            ? matchingSlotsForArchived(
                sessionItems[sessionCategory],
                item,
              )
            : [];
        const thumb = screenshotPublicUrl(item.screenshotPath);
        const title = item.description.trim() || item.name;
        return (
          <li key={item.id}>
            <article className="relative flex h-full min-h-11 w-full cursor-pointer flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <CardOpenTarget
                label={`Ver detalhes de ${title}`}
                onOpen={() => onSelect(item.id)}
              />
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
                  {title}
                </p>
              </div>
              {item.tags.length > 0 ? (
                <ItemTags tags={item.tags.map((t) => t.label)} />
              ) : null}
              <div className="relative z-10 mt-auto">
                <ArchiveItemActions
                  item={item}
                  onDetails={() => onSelect(item.id)}
                />
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
