import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  hasActiveArchiveFilters,
  matchesArchiveFilters,
  type ArchiveFilterInput,
} from "@/lib/archive-filters";
import { archiveUiCategory } from "@/lib/archive-match";
import { asNumber, asRecord, asString } from "@/lib/nms/value";
import {
  archivedMetadataSchema,
  slugifyTag,
  type ArchivedMetadata,
} from "@/lib/validations";
import { logOperation } from "@/server/operations";
import { deleteScreenshot } from "@/server/screenshots";
import type {
  ArchivedItemDetail,
  ArchivedItemSummary,
  ArchiveFilterOptions,
} from "@/types/archive";

export type { ArchivedItemDetail, ArchivedItemSummary, ArchiveFilterOptions };

export type ArchiveItemInput = {
  category: string;
  name: string;
  seed: string;
  description: string;
  metadata: ArchivedMetadata;
  screenshotPath?: string;
  coordinates?: string;
  galaxy?: number;
  sourceSaveId?: string;
  tags: string[];
};

export type ListItemsFilter = ArchiveFilterInput & {
  category?: string;
};

function metadataSummary(metadata: unknown): {
  gameVersion: number | null;
  className: string;
  shipType: string;
  filename: string;
  extra?: { baseType?: string };
} {
  const rec = asRecord(metadata) ?? {};
  const extraRec = asRecord(rec.extra);
  const baseType = asString(extraRec?.baseType);
  return {
    gameVersion: asNumber(rec.gameVersion),
    className: asString(rec.className) ?? "",
    shipType: asString(rec.shipType) ?? "",
    filename: asString(rec.filename) ?? "",
    extra: baseType ? { baseType } : undefined,
  };
}

function toSummary(row: {
  id: string;
  category: string;
  name: string;
  seed: string;
  description: string;
  galaxy: number | null;
  coordinates: string | null;
  screenshotPath: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: { slug: string; label: string } }[];
}): ArchivedItemSummary {
  const extra = metadataSummary(row.metadata);
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    seed: row.seed,
    description: row.description,
    galaxy: row.galaxy,
    coordinates: row.coordinates,
    screenshotPath: row.screenshotPath,
    gameVersion: extra.gameVersion,
    className: extra.className,
    shipType: extra.shipType,
    filename: extra.filename,
    extra: extra.extra,
    tags: row.tags.map((t) => t.tag),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function metadataAsArchiveHint(category: string, metadata: unknown) {
  const rec = asRecord(metadata) ?? {};
  const extra = asRecord(rec.extra);
  return {
    category,
    shipType: asString(rec.shipType),
    extra: extra
      ? { baseType: asString(extra.baseType) ?? undefined }
      : undefined,
  };
}

const itemInclude = {
  tags: { include: { tag: true } },
} as const;

async function syncTags(
  prisma: PrismaClient,
  itemId: string,
  labels: string[],
) {
  const unique = new Map<string, string>();
  for (const label of labels) {
    const slug = slugifyTag(label);
    if (!unique.has(slug)) unique.set(slug, label);
  }
  await prisma.itemTag.deleteMany({ where: { itemId } });
  for (const [slug, label] of unique) {
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { label },
      create: { slug, label },
    });
    await prisma.itemTag.create({
      data: { itemId, tagId: tag.id },
    });
  }
}

export async function createSaveMetadata(
  prisma: PrismaClient,
  input: {
    fileName: string;
    platform: string;
    gameVersion?: number;
    formatHint?: string;
    playerName?: string;
    saveName?: string;
    galaxy?: number;
    playTimeSec?: number;
    sha256: string;
    slotHint?: string;
  },
) {
  const existing = await prisma.save.findFirst({
    where: { sha256: input.sha256 },
  });
  const data = {
    fileName: input.fileName,
    platform: input.platform,
    gameVersion: input.gameVersion ?? null,
    formatHint: input.formatHint ?? null,
    playerName: input.playerName ?? null,
    saveName: input.saveName ?? null,
    galaxy: input.galaxy ?? null,
    playTimeSec:
      input.playTimeSec == null ? null : BigInt(Math.round(input.playTimeSec)),
    slotHint: input.slotHint ?? null,
  };
  if (existing) {
    const updated = await prisma.save.update({
      where: { id: existing.id },
      data,
    });
    return { save: updated, created: false };
  }
  const created = await prisma.save.create({
    data: { ...data, sha256: input.sha256 },
  });
  await logOperation(prisma, {
    action: "save_create",
    saveId: created.id,
    detail: {
      fileName: created.fileName,
      sha256: created.sha256,
    },
  });
  return { save: created, created: true };
}

export async function archiveItem(prisma: PrismaClient, input: ArchiveItemInput) {
  if (input.sourceSaveId) {
    const save = await prisma.save.findUnique({
      where: { id: input.sourceSaveId },
    });
    if (!save) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Save de origem não encontrado.",
      });
    }
  }
  const item = await prisma.archivedItem.create({
    data: {
      category: input.category,
      name: input.name,
      seed: input.seed.toLowerCase(),
      description: input.description,
      metadata: input.metadata as Prisma.InputJsonValue,
      screenshotPath: input.screenshotPath ?? null,
      coordinates: input.coordinates ?? null,
      galaxy: input.galaxy ?? null,
      sourceSaveId: input.sourceSaveId ?? null,
    },
    include: itemInclude,
  });
  await syncTags(prisma, item.id, input.tags);
  await logOperation(prisma, {
    action: "archive",
    category: item.category,
    itemId: item.id,
    saveId: item.sourceSaveId,
    detail: { name: item.name, seed: item.seed },
  });
  const reloaded = await prisma.archivedItem.findUniqueOrThrow({
    where: { id: item.id },
    include: itemInclude,
  });
  return toSummary(reloaded);
}

function inArchiveCategory(
  row: { category: string; metadata: unknown },
  category?: string,
): boolean {
  if (!category) return true;
  const ui = archiveUiCategory(
    metadataAsArchiveHint(row.category, row.metadata),
  );
  if (category === "freighter") {
    return row.category === "freighter" || ui === "freighter";
  }
  if (category === "deepspace") {
    return row.category === "deepspace" || ui === "deepspace";
  }
  if (category === "spacestation") {
    return row.category === "spacestation" || ui === "spacestation";
  }
  if (category === "base") return ui === "base" && row.category === "base";
  return row.category === category;
}

export async function listItems(
  prisma: PrismaClient,
  filter: ListItemsFilter = {},
): Promise<ArchivedItemSummary[]> {
  const category = filter.category;
  const splitFromBase =
    category === "freighter" ||
    category === "deepspace" ||
    category === "spacestation";
  const where = splitFromBase
    ? { category: { in: [category, "base"] } }
    : category
      ? { category }
      : undefined;
  const rows = await prisma.archivedItem.findMany({
    where,
    include: itemInclude,
    orderBy: { createdAt: "desc" },
  });
  const extras: ArchiveFilterInput = {
    className: filter.className,
    itemType: filter.itemType,
    tags: filter.tags,
    galaxy: filter.galaxy,
    q: filter.q,
    seed: filter.seed,
  };
  return rows
    .filter((row) => inArchiveCategory(row, category))
    .map(toSummary)
    .filter((item) =>
      hasActiveArchiveFilters(extras)
        ? matchesArchiveFilters(item, extras)
        : true,
    );
}

export async function listTags(
  prisma: PrismaClient,
  query?: string,
): Promise<{ slug: string; label: string }[]> {
  const rows = await prisma.tag.findMany({
    orderBy: { slug: "asc" },
    take: 200,
  });
  const needle = query?.trim().toLowerCase() ?? "";
  const slugNeedle = needle ? slugifyTag(needle) : "";
  return rows
    .filter((tag) => {
      if (!needle) return true;
      return (
        tag.slug.includes(slugNeedle) ||
        tag.label.toLowerCase().includes(needle)
      );
    })
    .slice(0, 40)
    .map((tag) => ({ slug: tag.slug, label: tag.label }));
}

export async function listFilterOptions(
  prisma: PrismaClient,
  category?: string,
): Promise<ArchiveFilterOptions> {
  const items = await listItems(prisma, { category });
  const classes = new Set<string>();
  const types = new Set<string>();
  const galaxies = new Set<number>();
  const tags = new Map<string, string>();
  for (const item of items) {
    if (item.className) classes.add(item.className);
    if (item.shipType) types.add(item.shipType);
    if (item.galaxy != null) galaxies.add(item.galaxy);
    for (const tag of item.tags) {
      if (!tags.has(tag.slug)) tags.set(tag.slug, tag.label);
    }
  }
  return {
    classes: [...classes].sort(),
    types: [...types].sort((a, b) => a.localeCompare(b, "pt-BR")),
    galaxies: [...galaxies].sort((a, b) => a - b),
    tags: [...tags.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slug, label]) => ({ slug, label })),
  };
}

export async function countItemsByCategory(
  prisma: PrismaClient,
): Promise<Record<string, number>> {
  const grouped = await prisma.archivedItem.groupBy({
    by: ["category"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const row of grouped) {
    counts[row.category] = row._count._all;
  }
  const bases = await prisma.archivedItem.findMany({
    where: { category: "base" },
    select: { category: true, metadata: true },
  });
  const remapped = bases.reduce(
    (countsAcc, row) => {
      const ui = archiveUiCategory(
        metadataAsArchiveHint(row.category, row.metadata),
      );
      if (ui === "base") return countsAcc;
      countsAcc[ui] = (countsAcc[ui] ?? 0) + 1;
      return countsAcc;
    },
    {} as Record<string, number>,
  );
  const remappedTotal = Object.values(remapped).reduce((a, b) => a + b, 0);
  if (remappedTotal > 0) {
    for (const [ui, n] of Object.entries(remapped)) {
      counts[ui] = (counts[ui] ?? 0) + n;
    }
    const nextBase = (counts.base ?? 0) - remappedTotal;
    if (nextBase > 0) counts.base = nextBase;
    else delete counts.base;
  }
  return counts;
}

export async function getItem(
  prisma: PrismaClient,
  id: string,
): Promise<ArchivedItemDetail> {
  const row = await prisma.archivedItem.findUnique({
    where: { id },
    include: itemInclude,
  });
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Item não encontrado no arquivo.",
    });
  }
  const parsed = archivedMetadataSchema.safeParse(row.metadata);
  const metadata: ArchivedMetadata = parsed.success
    ? parsed.data
    : { gameVersion: 0, payload: row.metadata };
  return {
    ...toSummary(row),
    payload: metadata.payload,
    metadata,
    sourceSaveId: row.sourceSaveId,
  };
}

export async function updateItem(
  prisma: PrismaClient,
  input: {
    id: string;
    description?: string;
    tags?: string[];
    screenshotPath?: string | null;
    className?: string | null;
    extra?: Record<string, string>;
  },
): Promise<ArchivedItemSummary> {
  const existing = await prisma.archivedItem.findUnique({
    where: { id: input.id },
  });
  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Item não encontrado no arquivo.",
    });
  }
  if (input.description != null) {
    await prisma.archivedItem.update({
      where: { id: input.id },
      data: { description: input.description },
    });
  }
  if (input.tags) {
    await syncTags(prisma, input.id, input.tags);
  }
  if (input.screenshotPath !== undefined) {
    const previous = existing.screenshotPath;
    await prisma.archivedItem.update({
      where: { id: input.id },
      data: { screenshotPath: input.screenshotPath },
    });
    if (previous && previous !== input.screenshotPath) {
      await deleteScreenshot(previous);
    }
  }
  if (input.className !== undefined || input.extra) {
    const rec = asRecord(existing.metadata) ?? {};
    const currentExtra = asRecord(rec.extra);
    const extra = input.extra
      ? input.extra
      : currentExtra
        ? Object.fromEntries(
            Object.entries(currentExtra).flatMap(([key, value]) =>
              typeof value === "string" ? [[key, value]] : [],
            ),
          )
        : undefined;
    const metadata = {
      ...rec,
      className:
        input.className === undefined
          ? rec.className
          : input.className || undefined,
      extra,
    };
    await prisma.archivedItem.update({
      where: { id: input.id },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
  }
  await logOperation(prisma, {
    action: "update",
    category: existing.category,
    itemId: existing.id,
    saveId: existing.sourceSaveId,
    detail: {
      name: existing.name,
      seed: existing.seed,
      description: input.description != null,
      tags: input.tags != null,
      screenshot: input.screenshotPath !== undefined,
      rank: input.className !== undefined || input.extra != null,
    },
  });
  const reloaded = await prisma.archivedItem.findUniqueOrThrow({
    where: { id: input.id },
    include: itemInclude,
  });
  return toSummary(reloaded);
}

export async function deleteItem(prisma: PrismaClient, id: string) {
  const existing = await prisma.archivedItem.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Item não encontrado no arquivo.",
    });
  }
  await logOperation(prisma, {
    action: "delete",
    category: existing.category,
    itemId: existing.id,
    saveId: existing.sourceSaveId,
    detail: { name: existing.name, seed: existing.seed },
  });
  await prisma.archivedItem.delete({ where: { id } });
  await deleteScreenshot(existing.screenshotPath);
  return { id };
}

export function serializeSave(save: {
  id: string;
  fileName: string;
  platform: string;
  gameVersion: number | null;
  formatHint: string | null;
  playerName: string | null;
  saveName: string | null;
  galaxy: number | null;
  playTimeSec: bigint | null;
  sha256: string;
  slotHint: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...save,
    playTimeSec:
      save.playTimeSec == null ? null : Number(save.playTimeSec),
  };
}
