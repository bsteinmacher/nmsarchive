"use client";

import { SaveCategoryPanel } from "./save-category-panel";

/** Compat: a tabela de naves usa o painel genérico da Fase 3. */
export function ShipPanel() {
  return <SaveCategoryPanel category="ship" />;
}
