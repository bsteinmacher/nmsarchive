import { z } from "zod";
import { CATEGORIES, type Category } from "@/types/nms";
import { getAdapter, seedFromPayload } from "@/lib/nms/extract";
import { summarizePlayer } from "@/lib/nms/player";

export const nmsItemSchema = z.object({
  nmsitem: z.literal(1),
  exportedAt: z.string(),
  gameVersion: z.number(),
  category: z.enum(CATEGORIES),
  name: z.string(),
  seed: z.string().regex(/^0x[0-9a-fA-F]+$/),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  coordinates: z.string().optional(),
  galaxy: z.number().optional(),
  payload: z.unknown(),
});

export type NmsItemFile = z.infer<typeof nmsItemSchema>;

export type BuildNmsItemInput = {
  category: Category;
  name: string;
  seed: string;
  payload: unknown;
  gameVersion: number;
  description?: string;
  tags?: string[];
  coordinates?: string;
  galaxy?: number;
};

export function buildNmsItem(input: BuildNmsItemInput): NmsItemFile {
  return nmsItemSchema.parse({
    nmsitem: 1,
    exportedAt: new Date().toISOString(),
    gameVersion: input.gameVersion,
    category: input.category,
    name: input.name,
    seed: input.seed.toLowerCase(),
    description: input.description ?? "",
    tags: input.tags ?? [],
    coordinates: input.coordinates,
    galaxy: input.galaxy,
    payload: input.payload,
  });
}

export function parseNmsItem(text: string): NmsItemFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Arquivo .nmsitem não é JSON válido.");
  }
  const parsed = nmsItemSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Arquivo .nmsitem não segue o schema esperado.");
  }
  return parsed.data;
}

export function serializeNmsItem(item: NmsItemFile): string {
  return JSON.stringify(item, null, 2);
}

export function payloadSeedMismatch(item: NmsItemFile): string | null {
  const payloadSeed = seedFromPayload(item.category, item.payload);
  if (payloadSeed.toLowerCase() !== item.seed.toLowerCase()) {
    const adapter = getAdapter(item.category);
    return `seed do envelope (${item.seed}) ≠ payload (${payloadSeed}) [${adapter.label}]`;
  }
  return null;
}

/** @deprecated use payloadSeedMismatch */
export function shipSeedMismatch(item: NmsItemFile): string | null {
  return payloadSeedMismatch(item);
}

export function gameVersionMismatch(
  item: NmsItemFile,
  saveJson: unknown,
): string | null {
  const version = summarizePlayer(saveJson).gameVersion;
  if (item.gameVersion !== version) {
    return `Versão do item (${item.gameVersion}) difere do save aberto (${version}).`;
  }
  return null;
}
