/**
 * Troca dois índices sem compactar nem mudar o length.
 * Slots vazios participam. PLAN §2.7.5.
 */
export function reorderSlots<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr.slice();
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= arr.length ||
    to >= arr.length
  ) {
    throw new Error("Índices de slot fora do array.");
  }
  const next = arr.slice();
  const tmp = next[from]!;
  next[from] = next[to]!;
  next[to] = tmp;
  return next;
}

/** Atualiza um ponteiro de índice depois de um swap from↔to. */
export function remapSlotIndex(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (index === to) return from;
  return index;
}
