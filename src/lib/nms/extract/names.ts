import { asRecord, asString } from "../value";

/** IDs do jogo costumam vir com `^` (HOVER_PET, JET1, …). */
export function stripCaret(value: string): string {
  return value.replace(/^\^+/, "").trim();
}

export function displayId(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "";
  return stripCaret(raw);
}

export function nestedEnum(
  value: unknown,
  key: string,
): string {
  const rec = asRecord(value);
  return displayId(rec?.[key] ?? asString(value));
}

export function biomeLabel(value: unknown): string {
  return nestedEnum(value, "Biome");
}

export function emptySlotLabel(index: number): string {
  return `Slot ${index + 1} vazio`;
}
