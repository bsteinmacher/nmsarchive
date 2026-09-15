import { z } from "zod";
import { CATEGORIES } from "@/types/nms";

export const SEED_RE = /^0x[0-9a-fA-F]+$/;
export const SHA256_RE = /^[0-9a-f]{64}$/;
export const TAG_LABEL_MAX = 40;
export const TAGS_MAX = 20;
export const DESCRIPTION_MAX = 2000;
export const BACKUP_KEEP_DEFAULT = 20;
export const BACKUP_NAME_RE = /^nmsarchive-\d{8}-\d{6}\.db$/;

export const categorySchema = z.enum(CATEGORIES);

export const seedSchema = z
  .string()
  .regex(SEED_RE, "Seed deve ser hex com prefixo 0x.");

export const sha256Schema = z
  .string()
  .regex(SHA256_RE, "SHA-256 deve ser 64 hex minúsculos.");

export const tagLabelSchema = z
  .string()
  .trim()
  .min(1, "Tag vazia.")
  .max(TAG_LABEL_MAX, `Tag com no máximo ${TAG_LABEL_MAX} caracteres.`);

export const tagsSchema = z.array(tagLabelSchema).max(TAGS_MAX);

export const descriptionSchema = z
  .string()
  .trim()
  .min(1, "Descrição é obrigatória.")
  .max(DESCRIPTION_MAX);

export const archivedMetadataSchema = z.object({
  gameVersion: z.number(),
  className: z.string().optional(),
  shipType: z.string().optional(),
  filename: z.string().optional(),
  extra: z.record(z.string(), z.string()).optional(),
  payload: z.unknown(),
});

export type ArchivedMetadata = z.infer<typeof archivedMetadataSchema>;

export const ITEM_CLASSES = ["S", "A", "B", "C"] as const;
export type ItemClass = (typeof ITEM_CLASSES)[number];

export const itemClassSchema = z.enum(ITEM_CLASSES);

/** Basename UUID.webp — o único path de screenshot aceito no banco. */
export const SCREENSHOT_FILE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;

export const screenshotPathSchema = z
  .string()
  .regex(SCREENSHOT_FILE_RE, "Screenshot inválido.");

export const saveMetadataInputSchema = z.object({
  fileName: z.string().trim().min(1).max(260),
  platform: z.string().trim().min(1).max(64),
  gameVersion: z.number().int().optional(),
  formatHint: z.string().trim().max(32).optional(),
  playerName: z.string().trim().max(120).optional(),
  saveName: z.string().trim().max(200).optional(),
  galaxy: z.number().int().min(0).max(255).optional(),
  playTimeSec: z.number().nonnegative().optional(),
  sha256: sha256Schema,
  slotHint: z.string().trim().max(64).optional(),
});

export const archiveItemInputSchema = z.object({
  category: categorySchema,
  name: z.string().trim().min(1).max(200),
  seed: seedSchema,
  description: descriptionSchema,
  metadata: archivedMetadataSchema,
  screenshotPath: screenshotPathSchema.optional(),
  coordinates: z.string().trim().max(32).optional(),
  galaxy: z.number().int().min(0).max(255).optional(),
  sourceSaveId: z.string().uuid().optional(),
  tags: tagsSchema.default([]),
});

export const updateItemInputSchema = z.object({
  id: z.string().uuid(),
  description: descriptionSchema.optional(),
  tags: tagsSchema.optional(),
  screenshotPath: screenshotPathSchema.nullable().optional(),
  className: z.string().trim().max(16).nullable().optional(),
  extra: z.record(z.string(), z.string()).optional(),
});

export const listItemsInputSchema = z.object({
  category: categorySchema.optional(),
  className: z.string().trim().min(1).max(16).optional(),
  itemType: z.string().trim().min(1).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(TAG_LABEL_MAX)).max(TAGS_MAX).optional(),
  galaxy: z.number().int().min(0).max(255).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  seed: seedSchema.optional(),
});

export const listTagsInputSchema = z.object({
  q: z.string().trim().max(40).optional(),
});

export const itemIdInputSchema = z.object({
  id: z.string().uuid(),
});

export const listLogsInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  action: z.string().trim().min(1).max(64).optional(),
});

export const restoreBackupInputSchema = z.object({
  fileName: z.string().regex(BACKUP_NAME_RE, "Nome de backup inválido."),
});

export const restoreUploadInputSchema = z.object({
  bytes: z.instanceof(Uint8Array).refine((b) => b.byteLength > 0, {
    message: "Arquivo .db vazio.",
  }),
  fileName: z.string().trim().min(1).max(260).optional(),
});

export function slugifyTag(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "tag";
}

export function parseTagInput(raw: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const label = part.trim();
    if (!label) continue;
    const parsed = tagLabelSchema.safeParse(label);
    if (!parsed.success) continue;
    const key = slugifyTag(parsed.data);
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(parsed.data);
    if (labels.length >= TAGS_MAX) break;
  }
  return labels;
}
