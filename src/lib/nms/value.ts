export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeSeed(value: unknown): string {
  if (Array.isArray(value) && value.length >= 2) {
    return normalizeSeed(value[1]);
  }
  if (typeof value === "string") {
    if (/^0x[0-9a-fA-F]+$/.test(value)) {
      return "0x" + value.slice(2).toLowerCase();
    }
    if (/^[0-9a-fA-F]+$/.test(value)) {
      return "0x" + value.toLowerCase();
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return "0x" + Math.trunc(value).toString(16);
  }
  return "0x0";
}

export function nameFromFilename(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  return base.replace(/\.SCENE\.MBIN$/i, "").replace(/\.MBIN$/i, "");
}
