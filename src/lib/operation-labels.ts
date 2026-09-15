export const OPERATION_LABELS: Record<string, string> = {
  archive: "Arquivou",
  update: "Atualizou",
  delete: "Excluiu",
  backup: "Backup",
  restore: "Restaurou",
  mapping_update: "Mapping atualizado",
  save_create: "Save registrado",
  export: "Exportou",
  import: "Importou",
  currency_edit: "Editou moedas",
  reorder: "Reordenou",
};

export function formatOperationLabel(action: string): string {
  return OPERATION_LABELS[action] ?? action;
}
