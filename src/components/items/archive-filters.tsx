"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListViewToggle } from "@/components/items/list-view-toggle";
import { TagInput } from "@/components/items/tag-input";
import {
  classFilterOptions,
  type ArchiveUrlState,
} from "@/lib/archive-url";
import { cn } from "cn";
import type { ArchiveFilterOptions } from "@/types/archive";
import type { Category } from "@/types/nms";

const selectClass = cn(
  "h-8 w-full min-h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
);

function hasFilters(state: ArchiveUrlState): boolean {
  return Boolean(
    state.className || state.itemType || state.tags.length || state.q,
  );
}

export function ArchiveFilters({
  idPrefix,
  category,
  state,
  options,
  onChange,
  resultCount,
}: {
  idPrefix: string;
  category?: Category;
  state: ArchiveUrlState;
  options: ArchiveFilterOptions;
  onChange: (next: ArchiveUrlState) => void;
  resultCount?: number;
}) {
  const qId = `${idPrefix}-q`;
  const classId = `${idPrefix}-class`;
  const typeId = `${idPrefix}-type`;
  const tagsId = `${idPrefix}-tags`;
  const tagsHintId = `${idPrefix}-tags-hint`;
  const classOptions = classFilterOptions(category);
  const typeGroups = options.typeGroups ?? [];
  const flatTypes = typeGroups.flatMap((group) => group.types);
  const active = hasFilters(state);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={qId}>Buscar</Label>
          <Input
            id={qId}
            type="search"
            value={state.q ?? ""}
            placeholder="Título ou descrição"
            autoComplete="off"
            onChange={(e) =>
              onChange({
                ...state,
                q: e.target.value || undefined,
              })
            }
          />
        </div>
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor={classId}>Class</Label>
            <select
              id={classId}
              className={selectClass}
              value={state.className ?? ""}
              onChange={(e) =>
                onChange({
                  ...state,
                  className: e.target.value || undefined,
                })
              }
            >
              <option value="">Qualquer</option>
              {classOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor={typeId}>Type</Label>
            <select
              id={typeId}
              className={selectClass}
              value={state.itemType ?? ""}
              onChange={(e) =>
                onChange({
                  ...state,
                  itemType: e.target.value || undefined,
                })
              }
            >
              <option value="">Qualquer</option>
              {typeGroups.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.types.map((value) => (
                    <option key={`${group.id}-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </optgroup>
              ))}
              {state.itemType && !flatTypes.includes(state.itemType) ? (
                <option value={state.itemType}>{state.itemType}</option>
              ) : null}
            </select>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor={tagsId}>Tags</Label>
            <TagInput
              id={tagsId}
              value={state.tags}
              onChange={(tags) => onChange({ ...state, tags })}
              placeholder="exotic"
              describedBy={tagsHintId}
            />
          </div>
          <p
            id={tagsHintId}
            className="text-pretty text-xs leading-snug text-muted-foreground sm:col-span-2 lg:col-span-1 lg:col-start-3"
          >
            Todas as tags escolhidas precisam bater.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            {resultCount == null
              ? "Filtrando…"
              : `${resultCount} ${resultCount === 1 ? "item" : "itens"}`}
          </p>
          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  tags: [],
                  view: state.view,
                })
              }
            >
              Limpar filtros
            </Button>
          ) : null}
        </div>
        <ListViewToggle
          value={state.view}
          onChange={(view) => onChange({ ...state, view })}
        />
      </div>
    </div>
  );
}
