import type { ExtractedSlot } from "@/lib/nms/extract/types";

export function matchingItems(
  items: ExtractedSlot[],
  seed: string,
  category: string,
): ExtractedSlot[] {
  const normalized = seed.toLowerCase();
  if (!normalized || normalized === "0x0") {
    return items.filter(
      (item) =>
        !item.empty &&
        !item.readonly &&
        item.category === category &&
        item.seed.toLowerCase() === normalized &&
        item.group !== "automatic",
    );
  }
  return items.filter(
    (item) =>
      !item.empty &&
      !item.readonly &&
      item.category === category &&
      item.seed.toLowerCase() === normalized,
  );
}

/** @deprecated use matchingItems */
export function matchingShips(
  ships: ExtractedSlot[],
  seed: string,
  category: string,
): ExtractedSlot[] {
  return matchingItems(ships, seed, category);
}
