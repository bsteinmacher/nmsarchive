"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("archive");
  const { current, interior } = splitFreighterArchive(freighters);

  if (group === "freighter") {
    return (
      <div className="grid min-w-0 gap-8">
        <ArchiveSection
          title={t("freighterTitle")}
          description={t("freighterDescription")}
          category="freighter"
          items={current}
          view={view}
          onSelect={onSelect}
          empty={t("freighterEmpty")}
        />
        <ArchiveSection
          id="freighter-base"
          title={t("freighterBaseTitle")}
          description={t("freighterBaseDescription")}
          category="base"
          items={interior}
          view={view}
          onSelect={onSelect}
          empty={t("freighterBaseEmpty")}
        />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-8">
      <ArchiveSection
        title={t("planetBasesTitle")}
        description={t("planetBasesDescription")}
        category="base"
        items={planetBases}
        view={view}
        onSelect={onSelect}
        empty={t("planetBasesEmpty")}
      />
      <ArchiveSection
        id="deepspace"
        title={t("deepSpaceTitle")}
        description={t("deepSpaceDescription")}
        category="deepspace"
        items={deepspace}
        view={view}
        onSelect={onSelect}
        empty={t("deepSpaceEmpty")}
      />
      <ArchiveSection
        id="spacestations"
        title={t("stationsTitle")}
        description={t("stationsDescription")}
        category="spacestation"
        items={stations}
        view={view}
        onSelect={onSelect}
        empty={t("stationsEmpty")}
      />
    </div>
  );
}
