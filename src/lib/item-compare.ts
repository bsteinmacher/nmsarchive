export type ShallowField = "seed" | "className" | "itemType";

export type ShallowDiffRow = {
  field: ShallowField;
  label: string;
  archived: string;
  save: string;
  match: boolean;
};

export type CompareSide = {
  seed: string;
  className: string;
  itemType: string;
};

const SHALLOW_FIELDS: { field: ShallowField; label: string }[] = [
  { field: "seed", label: "Seed" },
  { field: "className", label: "Classe" },
  { field: "itemType", label: "Tipo" },
];

function normalize(field: ShallowField, value: string): string {
  const trimmed = value.trim();
  if (field === "seed") return trimmed.toLowerCase();
  if (field === "className") return trimmed.toUpperCase();
  return trimmed.toLowerCase();
}

export function shallowItemDiff(
  archived: CompareSide,
  save: CompareSide,
): ShallowDiffRow[] {
  return SHALLOW_FIELDS.map(({ field, label }) => {
    const left = archived[field] ?? "";
    const right = save[field] ?? "";
    const match =
      Boolean(left) &&
      Boolean(right) &&
      normalize(field, left) === normalize(field, right);
    const bothEmpty = !left && !right;
    return {
      field,
      label,
      archived: left || "—",
      save: right || "—",
      match: bothEmpty || match,
    };
  });
}

export type JsonDiffKind =
  | "same"
  | "changed"
  | "only-archived"
  | "only-save";

export type JsonDiffNode = {
  key: string;
  kind: JsonDiffKind;
  archived?: unknown;
  save?: unknown;
  children?: JsonDiffNode[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function jsonDiff(
  archived: unknown,
  save: unknown,
  key = "payload",
): JsonDiffNode {
  if (valuesEqual(archived, save)) {
    return { key, kind: "same", archived, save };
  }
  if (Array.isArray(archived) && Array.isArray(save)) {
    const length = Math.max(archived.length, save.length);
    const children: JsonDiffNode[] = [];
    for (let i = 0; i < length; i++) {
      const hasA = i < archived.length;
      const hasB = i < save.length;
      if (!hasA) {
        children.push({
          key: String(i),
          kind: "only-save",
          save: save[i],
        });
        continue;
      }
      if (!hasB) {
        children.push({
          key: String(i),
          kind: "only-archived",
          archived: archived[i],
        });
        continue;
      }
      children.push(jsonDiff(archived[i], save[i], String(i)));
    }
    const kind = children.every((c) => c.kind === "same") ? "same" : "changed";
    return { key, kind, archived, save, children };
  }
  if (isPlainObject(archived) && isPlainObject(save)) {
    const names = [...new Set([...Object.keys(archived), ...Object.keys(save)])];
    names.sort();
    const children: JsonDiffNode[] = [];
    for (const name of names) {
      const hasA = Object.prototype.hasOwnProperty.call(archived, name);
      const hasB = Object.prototype.hasOwnProperty.call(save, name);
      if (!hasA) {
        children.push({ key: name, kind: "only-save", save: save[name] });
        continue;
      }
      if (!hasB) {
        children.push({
          key: name,
          kind: "only-archived",
          archived: archived[name],
        });
        continue;
      }
      children.push(jsonDiff(archived[name], save[name], name));
    }
    const kind = children.every((c) => c.kind === "same") ? "same" : "changed";
    return { key, kind, archived, save, children };
  }
  if (archived === undefined) {
    return { key, kind: "only-save", save };
  }
  if (save === undefined) {
    return { key, kind: "only-archived", archived };
  }
  return { key, kind: "changed", archived, save };
}

export function jsonDiffHasChanges(node: JsonDiffNode): boolean {
  return node.kind !== "same";
}

export function previewDiffValue(value: unknown, max = 80): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") {
    const shown = value.length > max ? `${value.slice(0, max)}…` : value;
    return JSON.stringify(shown);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object") {
    return `{${Object.keys(value as object).length}}`;
  }
  return String(value);
}
