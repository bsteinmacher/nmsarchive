"use client";

import { isArchivedFreighterBase } from "@/lib/archive-match";
import type { ArchiveView } from "@/lib/archive-url";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import type { Category } from "@/types/nms";
import type { ArchivedItemSummary } from "@/types/archive";
import { freighterGroupColumns } from "@/lib/list-columns";
import { ItemGrid } from "./item-grid";
import { ItemTable } from "./item-table";

function ArchiveSection({
  id,
  title,
  description,
  category,
  items,
  view,
  onSelect,
  empty,
  alignWithGroup = false,
}: {
  id?: string;
  title: string;
  description: string;
  category: Category;
  items: ArchivedItemSummary[];
  view: ArchiveView;
  onSelect: (id: string) => void;
  empty: string;
  alignWithGroup?: boolean;
}) {
  return (
    <section id={id} className="min-w-0 scroll-mt-6">
      <Card className="min-w-0">
        <CardHeader className="border-b">
          <h2 className="font-heading text-base leading-snug font-medium">
            {title}
          </h2>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent
          className={
            view === "table" && items.length > 0
              ? "min-w-0 px-0 [&_td:first-child]:ps-4 [&_td:last-child]:pe-4 [&_th:first-child]:ps-4 [&_th:last-child]:pe-4"
              : undefined
          }
        >
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{empty}</p>
          ) : view === "table" ? (
            <ItemTable
              items={items}
              category={category}
              columns={
                alignWithGroup ? freighterGroupColumns(category) : undefined
              }
              onSelect={onSelect}
            />
          ) : (
            <ItemGrid items={items} onSelect={onSelect} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function splitFreighterArchive(items: ArchivedItemSummary[]) {
  return {
    current: items.filter((item) => item.category === "freighter"),
    interior: items.filter(isArchivedFreighterBase),
  };
}

export function GroupedArchiveSections({
  group,
  view,
  onSelect,
  freighters = [],
  frigates = [],
  squadron = [],
  planetBases = [],
  deepspace = [],
  stations = [],
}: {
  group: "freighter" | "base";
  view: ArchiveView;
  onSelect: (id: string) => void;
  freighters?: ArchivedItemSummary[];
  frigates?: ArchivedItemSummary[];
  squadron?: ArchivedItemSummary[];
  planetBases?: ArchivedItemSummary[];
  deepspace?: ArchivedItemSummary[];
  stations?: ArchivedItemSummary[];
}) {
  const { current, interior } = splitFreighterArchive(freighters);

  if (group === "freighter") {
    return (
      <div className="grid min-w-0 gap-8">
        <ArchiveSection
          title="Freighter"
          description="O slot atual arquivado."
          category="freighter"
          items={current}
          view={view}
          onSelect={onSelect}
          empty="Nenhuma Freighter no arquivo."
          alignWithGroup
        />
        <ArchiveSection
          id="freighter-base"
          title="Freighter base"
          description="Interior da cargueira."
          category="base"
          items={interior}
          view={view}
          onSelect={onSelect}
          empty="Nenhuma Freighter base no arquivo."
          alignWithGroup
        />
        <ArchiveSection
          id="frigates"
          title="Frigates"
          description="Fragatas guardadas no arquivo pessoal."
          category="frigate"
          items={frigates}
          view={view}
          onSelect={onSelect}
          empty="Nenhuma Frigate no arquivo."
          alignWithGroup
        />
        <ArchiveSection
          id="squadron"
          title="Squadron"
          description="Pilotos do esquadrão guardados no arquivo pessoal."
          category="squadron"
          items={squadron}
          view={view}
          onSelect={onSelect}
          empty="Nenhum piloto no arquivo."
          alignWithGroup
        />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-8">
      <ArchiveSection
        title="Planet Bases"
        description="Bases planetárias e de Ship."
        category="base"
        items={planetBases}
        view={view}
        onSelect={onSelect}
        empty="Nenhuma base planetária no arquivo."
      />
      <ArchiveSection
        id="deepspace"
        title="Deep Space"
        description="Bases orbitais livres (COSMOS)."
        category="deepspace"
        items={deepspace}
        view={view}
        onSelect={onSelect}
        empty="Nenhuma Deep Space no arquivo."
      />
      <ArchiveSection
        id="spacestations"
        title="Space Stations"
        description="Estações reivindicadas. O jogo aceita até 20 por save."
        category="spacestation"
        items={stations}
        view={view}
        onSelect={onSelect}
        empty="Nenhuma Space Station no arquivo."
      />
    </div>
  );
}
