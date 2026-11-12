"use client";

import { Suspense, useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCategoryCopy } from "@/i18n/format";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive } from "lucide-react";
import { cn } from "cn";
import { ArchiveFilters } from "@/components/items/archive-filters";
import {
  GroupedArchiveSections,
  splitFreighterArchive,
} from "@/components/items/grouped-archive-home";
import { ItemDetailDialog } from "@/components/items/item-detail-dialog";
import { ItemGrid } from "@/components/items/item-grid";
import { ItemTable } from "@/components/items/item-table";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  archiveSearchHref,
  parseArchiveSearch,
  type ArchiveUrlState,
  type ArchiveView,
} from "@/lib/archive-url";
import { rememberArchiveView } from "@/lib/archive-view";
import {
  EMPTY_FILTER_OPTIONS,
  mergeArchiveFilterOptions,
} from "@/lib/type-groups";
import { trpc } from "@/lib/trpc";
import {
  archiveHref,
  SIDEBAR_CATEGORIES,
  type Category,
} from "@/types/nms";

function ArchiveHomeInner({
  category,
  storedView,
}: {
  category?: Category;
  storedView?: ArchiveView;
}) {
  const t = useTranslations("archive");
  const common = useTranslations("common");
  const categories = useCategoryCopy();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const state = useMemo(() => {
    const parsed = parseArchiveSearch(searchParams);
    if (searchParams.has("view") || storedView == null) return parsed;
    return { ...parsed, view: storedView };
  }, [searchParams, storedView]);

  const extras = useMemo(
    () => ({
      className: state.className,
      itemType: state.itemType,
      tags: state.tags.length ? state.tags : undefined,
      q: state.q?.trim() || undefined,
    }),
    [state],
  );
  const grouped = category === "freighter" || category === "base";
  const listInput = useMemo(
    () => ({
      category,
      ...extras,
    }),
    [category, extras],
  );

  const list = trpc.items.list.useQuery(listInput, { enabled: !grouped });
  const groupedFreighters = trpc.items.list.useQuery(
    { ...extras, category: "freighter" },
    { enabled: category === "freighter" },
  );
  const groupedPlanetBases = trpc.items.list.useQuery(
    { ...extras, category: "base" },
    { enabled: category === "base" },
  );
  const groupedDeepspace = trpc.items.list.useQuery(
    { ...extras, category: "deepspace" },
    { enabled: category === "base" },
  );
  const groupedStations = trpc.items.list.useQuery(
    { ...extras, category: "spacestation" },
    { enabled: category === "base" },
  );
  const ownOptions = trpc.items.filterOptions.useQuery({ category });
  const deepspaceOptions = trpc.items.filterOptions.useQuery(
    { category: "deepspace" },
    { enabled: category === "base" },
  );
  const stationOptions = trpc.items.filterOptions.useQuery(
    { category: "spacestation" },
    { enabled: category === "base" },
  );
  const options =
    category === "base"
      ? mergeArchiveFilterOptions([
          ownOptions.data,
          deepspaceOptions.data,
          stationOptions.data,
        ])
      : (ownOptions.data ?? EMPTY_FILTER_OPTIONS);
  const counts = trpc.items.counts.useQuery();
  const items = list.data?.items ?? [];
  const freightSplit = splitFreighterArchive(
    groupedFreighters.data?.items ?? [],
  );
  const groupedTotal =
    category === "freighter"
      ? freightSplit.current.length + freightSplit.interior.length
      : category === "base"
        ? (groupedPlanetBases.data?.items.length ?? 0) +
          (groupedDeepspace.data?.items.length ?? 0) +
          (groupedStations.data?.items.length ?? 0)
        : 0;
  const groupedLoading =
    category === "freighter"
      ? groupedFreighters.isLoading
      : category === "base"
        ? groupedPlanetBases.isLoading ||
          groupedDeepspace.isLoading ||
          groupedStations.isLoading
        : false;
  const groupedError =
    category === "freighter"
      ? groupedFreighters.error
      : category === "base"
        ? (groupedPlanetBases.error ??
          groupedDeepspace.error ??
          groupedStations.error)
        : null;
  const totalAll = Object.values(counts.data ?? {}).reduce((a, b) => a + b, 0);
  const categoryTotal =
    category == null
      ? totalAll
      : category === "base"
        ? (counts.data?.base ?? 0) +
          (counts.data?.deepspace ?? 0) +
          (counts.data?.spacestation ?? 0)
        : (counts.data?.[category] ?? 0);
  const filtersOn = Boolean(
    state.className || state.itemType || state.tags.length || state.q,
  );

  useEffect(() => {
    const explicit = searchParams.get("view");
    if (explicit === "table" || explicit === "grid") {
      rememberArchiveView(explicit);
    }
  }, [searchParams]);

  function setState(next: ArchiveUrlState) {
    rememberArchiveView(next.view);
    router.replace(archiveSearchHref(pathname, next), { scroll: false });
  }

  const qs = searchParams.toString();
  const withQuery = (href: string) => (qs ? `${href}?${qs}` : href);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("intro")}
        </p>
      </div>

      <nav aria-label={t("filterByCategory")} className="flex flex-wrap gap-2">
        <Link
          href={withQuery("/")}
          className={cn(
            buttonVariants({
              variant: category == null ? "default" : "outline",
              size: "sm",
            }),
          )}
        >
          {common("all")}
          {totalAll ? ` (${totalAll})` : ""}
        </Link>
        {SIDEBAR_CATEGORIES.map((slug) => {
          const count = counts.data?.[slug] ?? 0;
          const active = category === slug;
          return (
            <Link
              key={slug}
              href={withQuery(archiveHref(slug))}
              className={cn(
                buttonVariants({
                  variant: active ? "default" : "outline",
                  size: "sm",
                }),
              )}
            >
              {categories.label(slug)}
              {count ? ` (${count})` : ""}
            </Link>
          );
        })}
      </nav>

      <ArchiveFilters
        idPrefix={filterId}
        category={category}
        state={state}
        options={options}
        onChange={setState}
        resultCount={grouped ? groupedTotal : list.data?.total}
      />

      {grouped && groupedLoading ? (
        <p className="text-sm text-muted-foreground">{common("loadingArchive")}</p>
      ) : grouped && groupedError ? (
        <p className="text-sm text-destructive">{groupedError.message}</p>
      ) : grouped && groupedTotal > 0 ? (
        <GroupedArchiveSections
          group={category === "base" ? "base" : "freighter"}
          view={state.view}
          onSelect={setSelectedId}
          freighters={groupedFreighters.data?.items}
          planetBases={groupedPlanetBases.data?.items}
          deepspace={groupedDeepspace.data?.items}
          stations={groupedStations.data?.items}
        />
      ) : !grouped && list.isLoading ? (
        <p className="text-sm text-muted-foreground">{common("loadingArchive")}</p>
      ) : list.error ? (
        <p className="text-sm text-destructive">{list.error.message}</p>
      ) : items.length === 0 && filtersOn && categoryTotal > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("noMatchesTitle")}</CardTitle>
            <CardDescription>{t("noMatchesBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              className={cn(buttonVariants())}
              onClick={() => setState({ tags: [], view: state.view })}
            >
              {common("clearFilters")}
            </button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Archive
                className="mt-0.5 size-5 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <CardTitle>
                  {category
                    ? t("emptyCategory", { label: categories.label(category) })
                    : t("emptyArchive")}
                </CardTitle>
                <CardDescription>
                  {category
                    ? t("emptyCategoryHint", { label: categories.label(category) })
                    : t("emptyArchiveHint")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/save" className={cn(buttonVariants())}>
              {t("openSave")}
            </Link>
          </CardContent>
        </Card>
      ) : state.view === "table" ? (
        <ItemTable items={items} category={category} onSelect={setSelectedId} />
      ) : (
        <ItemGrid items={items} onSelect={setSelectedId} />
      )}

      <ItemDetailDialog
        itemId={selectedId}
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}

function ArchiveLoading() {
  const common = useTranslations("common");
  return (
    <p className="text-sm text-muted-foreground">{common("loadingArchive")}</p>
  );
}

export function ArchiveHome({
  category,
  storedView,
}: {
  category?: Category;
  storedView?: ArchiveView;
}) {
  return (
    <Suspense
      fallback={<ArchiveLoading />}
    >
      <ArchiveHomeInner category={category} storedView={storedView} />
    </Suspense>
  );
}
