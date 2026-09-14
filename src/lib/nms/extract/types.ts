import type { Category } from "@/types/nms";

export type ExtractedItem<TPayload = unknown> = {
  category: Category;
  index: number;
  name: string;
  seed: string;
  extra: Record<string, string>;
  payload: TPayload;
};

export type ExtractedShip = ExtractedItem<{
  Name?: unknown;
  Resource?: unknown;
  Inventory?: unknown;
  [key: string]: unknown;
}> & {
  className: string;
  filename: string;
};
