"use client";

import { isArchivedFreighterBase } from "@/lib/archive-match";
import type { ArchiveView } from "@/lib/archive-url";
import type { Category } from "@/types/nms";
import type { ArchivedItemSummary } from "@/types/archive";
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
}: {
  id?: string;
  title: string;
  description: string;
  category: Category;
  items: ArchivedItemSummary[];
  view: ArchiveView;
  onSelect: (id: string) => void;
  empty: string;
}) {
  return (
    <section id={id} className="grid min-w-0 scroll-mt-6 gap-3">
      <div className="grid gap-1">
        <h2 className="font-heading text-base leading-snug font-medium">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : view === "table" ? (
        <ItemTable items={items} category={category} onSelect={onSelect} />
      ) : (
        <ItemGrid items={items} onSelect={onSelect} />
      )}
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
  planetBases = [],
  deepspace = [],
  stations = [],
}: {
  group: "freighter" | "base";
  view: ArchiveView;
  onSelect: (id: string) => void;
  freighters?: ArchivedItemSummary[];
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
        />
        <ArchiveSection
          id="freighter-base"
          title="Freighter base"
          description="Interior da cargueira. Arquivar a Freighter não inclui esta construção."
          category="base"
          items={interior}
          view={view}
          onSelect={onSelect}
          empty="Nenhuma Freighter base no arquivo."
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
