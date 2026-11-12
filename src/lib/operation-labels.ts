export function formatOperationLabel(
  action: string,
  lookup: (action: string) => string | undefined,
): string {
  return lookup(action) ?? action;
}

export function logSubject(row: {
  item?: { name: string } | null;
  detail: unknown;
}): string | null {
  if (row.item?.name) return row.item.name;
  if (!row.detail || typeof row.detail !== "object") return null;
  if ("fileName" in row.detail && typeof row.detail.fileName === "string") {
    return row.detail.fileName;
  }
  if ("label" in row.detail && typeof row.detail.label === "string") {
    return row.detail.label;
  }
  return null;
}
