export const OPERATION_LABELS: Record<string, string> = {
  archive: "Arquivou",
  update: "Atualizou",
  delete: "Excluiu",
  backup: "Backup",
  restore: "Restaurou",
  mapping_update: "Mapping atualizado",
  save_create: "Save registrado",
  tag_create: "Criou tag",
  tag_update: "Atualizou tag",
  tag_delete: "Excluiu tag",
  export: "Exportou",
  import: "Importou",
  currency_edit: "Editou moedas",
  reorder: "Reordenou",
};

export function formatOperationLabel(action: string): string {
  return OPERATION_LABELS[action] ?? action;
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
