"use client";

import { matchingSlotsForArchived, sessionCategoryForArchived } from "@/lib/archive-match";
import { type AdapterColumn } from "@/lib/nms/extract";
import {
  archiveColumnValue,
  archiveDataColumns,
  listColumnClass,
  tableTagLabels,
} from "@/lib/list-columns";
import type { ArchivedItemSummary } from "@/types/archive";
import type { Category } from "@/types/nms";
import { useSaveSession } from "@/stores/save-session";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArchiveItemActions } from "./archive-item-actions";

export function ItemTable({
  items,
  category,
  columns: columnsProp,
  onSelect,
}: {
  items: ArchivedItemSummary[];
  category?: Category;
  columns?: readonly AdapterColumn[];
  onSelect: (id: string) => void;
}) {
  const sessionItems = useSaveSession((s) => s.items);
  const saveReady = useSaveSession((s) => s.status === "ready");
  const columns = columnsProp ?? archiveDataColumns(category);

  return (
    <Table className="min-w-6xl table-fixed">
      <colgroup>
        <col />
        {columns.map((col) => (
          <col key={col.id} className={listColumnClass(col.id)} />
        ))}
        <col className={listColumnClass("tags")} />
        <col className={listColumnClass("actions")} />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {columns.map((col) => (
            <TableHead key={col.id} className={listColumnClass(col.id)}>
              {col.header}
            </TableHead>
          ))}
          <TableHead className={listColumnClass("tags")}>Tags</TableHead>
          <TableHead className={listColumnClass("actions")}>
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const sessionCategory = sessionCategoryForArchived(item);
          const slots =
            saveReady && sessionCategory
              ? matchingSlotsForArchived(sessionItems[sessionCategory], item)
              : [];
          return (
            <TableRow key={item.id}>
              <TableCell className="whitespace-normal font-medium">
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="w-full rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="break-words whitespace-normal">
                    {item.description.trim() || item.name}
                  </span>
                  {slots.length > 0 ? (
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      No save · slot {slots[0].slotLabel ?? slots[0].index + 1}
                    </span>
                  ) : null}
                </button>
              </TableCell>
              {columns.map((col) => (
                <TableCell key={col.id} className="whitespace-nowrap">
                  {archiveColumnValue(item, col) || "—"}
                </TableCell>
              ))}
              <TableCell className="whitespace-normal text-muted-foreground">
                {tableTagLabels(item, columns).join(" · ") || "—"}
              </TableCell>
              <TableCell className="text-right">
                <ArchiveItemActions
                  item={item}
                  onDetails={() => onSelect(item.id)}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
