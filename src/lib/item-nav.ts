import type { ExtractedSlot } from "@/lib/nms/extract/types";

export function navigableSlots(items: ExtractedSlot[]): ExtractedSlot[] {
  return items.filter((item) => !item.empty && !item.readonly);
}

export function slotKey(item: ExtractedSlot): string {
  return `${item.group ?? "primary"}:${item.category}:${item.index}`;
}

export function neighborSlots(
  items: ExtractedSlot[],
  current: ExtractedSlot | null,
): { prev: ExtractedSlot | null; next: ExtractedSlot | null } {
  const filled = navigableSlots(items);
  if (!current || filled.length === 0) return { prev: null, next: null };
  const key = slotKey(current);
  const index = filled.findIndex((item) => slotKey(item) === key);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: filled[index - 1] ?? null,
    next: filled[index + 1] ?? null,
  };
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
