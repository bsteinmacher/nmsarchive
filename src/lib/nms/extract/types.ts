import type { Category } from "@/types/nms";

export type ExtractedItem<TPayload = unknown> = {
  category: Category;
  index: number;
  name: string;
  seed: string;
  extra: Record<string, string>;
  payload: TPayload;
};

export type ExtractedSlot<TPayload = unknown> = ExtractedItem<TPayload> & {
  empty: boolean;
  readonly?: boolean;
  className: string;
  itemType: string;
  filename: string;
  warning?: string;
  /** Rótulo da coluna Slot; default é o índice 1-based. */
  slotLabel?: string;
  /** Agrupa wonders automáticos numa listagem secundária. */
  group?: "primary" | "automatic";
};

export type ExtractedShip = ExtractedSlot<{
  Name?: unknown;
  Resource?: unknown;
  Inventory?: unknown;
  [key: string]: unknown;
}> & {
  shipType: string;
};

export type InsertResult =
  | { ok: true; json: unknown; index: number }
  | { ok: false; error: string };

export type WriteResult =
  | { ok: true; json: unknown }
  | { ok: false; error: string };

export type AdapterColumn = {
  id: string;
  header: string;
};

export type CategoryAdapter<TPayload = unknown> = {
  category: Category;
  label: string;
  columns: readonly AdapterColumn[];
  list(json: unknown): ExtractedSlot<TPayload>[];
  insert(json: unknown, payload: TPayload): InsertResult;
  replace?(json: unknown, index: number, payload: TPayload): InsertResult;
  reorder?(json: unknown, from: number, to: number): WriteResult;
  summarize(payload: TPayload): {
    name: string;
    seed: string;
    extra: Record<string, string>;
  };
  seedFromPayload(payload: unknown): string;
  missingMessage: string;
};
