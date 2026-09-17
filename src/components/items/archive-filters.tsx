"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListViewToggle } from "@/components/items/list-view-toggle";
import { TagInput } from "@/components/items/tag-input";
import {
  CLASS_FILTER_OPTIONS,
  type ArchiveUrlState,
} from "@/lib/archive-url";
import { formatGalaxy } from "@/lib/nms/galaxies";
import { cn } from "cn";
import type { ArchiveFilterOptions } from "@/types/archive";

const selectClass = cn(
  "h-8 w-full min-h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
);

function hasFilters(state: ArchiveUrlState): boolean {
  return Boolean(
    state.className ||
      state.itemType ||
      state.tags.length ||
      state.galaxyDisplay != null ||
      state.q,
  );
}

export function ArchiveFilters({
  idPrefix,
  state,
  options,
  onChange,
  resultCount,
}: {
  idPrefix: string;
  state: ArchiveUrlState;
  options: ArchiveFilterOptions;
  onChange: (next: ArchiveUrlState) => void;
  resultCount?: number;
}) {
  const qId = `${idPrefix}-q`;
  const classId = `${idPrefix}-class`;
  const typeId = `${idPrefix}-type`;
  const galaxyId = `${idPrefix}-galaxy`;
  const tagsId = `${idPrefix}-tags`;
  const tagsHintId = `${idPrefix}-tags-hint`;
  const classValues = new Set([
    ...CLASS_FILTER_OPTIONS.map((o) => o.value),
    ...options.classes,
  ]);
  const classOptions = [...classValues].sort();
  const typeOptions = options.types;
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
            placeholder="Nome ou descrição"
            autoComplete="off"
            onChange={(e) =>
              onChange({
                ...state,
                q: e.target.value || undefined,
              })
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor={classId}>Classe</Label>
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
              {classOptions.map((value) => (
                <option key={value} value={value}>
                  Classe {value}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={typeId}>Tipo</Label>
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
              {typeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              {state.itemType && !typeOptions.includes(state.itemType) ? (
                <option value={state.itemType}>{state.itemType}</option>
              ) : null}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={galaxyId}>Galáxia</Label>
            <select
              id={galaxyId}
              className={selectClass}
              value={state.galaxyDisplay != null ? String(state.galaxyDisplay) : ""}
              onChange={(e) =>
                onChange({
                  ...state,
                  galaxyDisplay: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            >
              <option value="">Qualquer</option>
              {options.galaxies.map((index) => (
                <option key={index} value={String(index + 1)}>
                  {formatGalaxy(index)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={tagsId}>Tags</Label>
            <TagInput
              id={tagsId}
              value={state.tags}
              onChange={(tags) => onChange({ ...state, tags })}
              placeholder="exotic"
              describedBy={tagsHintId}
            />
            <p id={tagsHintId} className="text-xs text-muted-foreground">
              Todas as tags escolhidas precisam bater.
            </p>
          </div>
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
