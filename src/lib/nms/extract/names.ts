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

const UI_SKIP_PARTS = new Set(["UI", "SPECIES", "NAME", "TITLE"]);

/** CreatureID cru ou UI_FIEND_NAME → FIEND. Nunca devolve a string UI_ completa. */
export function companionSpeciesTag(creatureId: unknown): string {
  const id = displayId(creatureId);
  if (!id) return "";
  if (!id.toUpperCase().startsWith("UI_")) return id;
  const parts = id.split("_").filter(Boolean);
  const core = parts.filter((part) => !UI_SKIP_PARTS.has(part.toUpperCase()));
  return core.join("_");
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
