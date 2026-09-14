"use client";

function preview(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object") {
    return `{${Object.keys(value as object).length}}`;
  }
  if (typeof value === "string") {
    const shown = value.length > 120 ? `${value.slice(0, 120)}…` : value;
    return JSON.stringify(shown);
  }
  return String(value);
}

function JsonNode({ name, value }: { name: string; value: unknown }) {
  if (value && typeof value === "object") {
    const entries = Array.isArray(value)
      ? value.map((item, i) => [String(i), item] as const)
      : Object.entries(value as Record<string, unknown>);
    return (
      <details className="ml-2">
        <summary className="cursor-pointer select-none text-muted-foreground">
          <span className="text-foreground">{name}</span> {preview(value)}
        </summary>
        <div className="border-l pl-2">
          {entries.map(([key, nested]) => (
            <JsonNode key={key} name={key} value={nested} />
          ))}
        </div>
      </details>
    );
  }
  return (
    <div className="ml-2 truncate">
      <span className="text-muted-foreground">{name}: </span>
      <span>{preview(value)}</span>
    </div>
  );
}

export function JsonTree({ value }: { value: unknown }) {
  return (
    <div className="max-h-[50vh] overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
      <JsonNode name="payload" value={value} />
    </div>
  );
}
