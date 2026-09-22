"use client";

import { archiveUiCategory, matchingSlotsForArchived, sessionCategoryForArchived } from "@/lib/archive-match";
import { formatGalaxy } from "@/lib/nms/galaxies";
import type { ArchivedItemSummary } from "@/types/archive";
import { CATEGORY_META, isCategory } from "@/types/nms";
import { useSaveSession } from "@/stores/save-session";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ItemTable({
  items,
  onSelect,
}: {
  items: ArchivedItemSummary[];
  onSelect: (id: string) => void;
}) {
  const sessionItems = useSaveSession((s) => s.items);
  const saveReady = useSaveSession((s) => s.status === "ready");
  const showBattle = items.some(
    (item) => item.extra?.element || item.extra?.biome,
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Type</TableHead>
          {showBattle ? (
            <>
              <TableHead>Element</TableHead>
              <TableHead>Biome</TableHead>
            </>
          ) : null}
          <TableHead>Seed</TableHead>
          <TableHead>Galaxy</TableHead>
          <TableHead>Tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
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
          const typeLabel =
            item.shipType ||
            (isCategory(uiCategory)
              ? CATEGORY_META[uiCategory].label
              : item.category);
          return (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="min-h-8 w-full rounded-md px-1 py-1 text-left hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="break-words whitespace-normal">{item.name}</span>
                  {slots.length > 0 ? (
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      No save · slot {slots[0].slotLabel ?? slots[0].index + 1}
                    </span>
                  ) : null}
                </button>
              </TableCell>
              <TableCell>{item.className || "—"}</TableCell>
              <TableCell className="whitespace-normal">{typeLabel}</TableCell>
              {showBattle ? (
                <>
                  <TableCell className="whitespace-normal">
                    {item.extra?.element || "—"}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {item.extra?.biome || "—"}
                  </TableCell>
                </>
              ) : null}
              <TableCell className="font-mono text-xs whitespace-normal break-all">
                {item.seed}
              </TableCell>
              <TableCell className="whitespace-normal">
                {item.galaxy != null ? formatGalaxy(item.galaxy) : "—"}
              </TableCell>
              <TableCell className="whitespace-normal text-muted-foreground">
                {item.tags.length
                  ? item.tags.map((t) => t.label).join(" · ")
                  : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
