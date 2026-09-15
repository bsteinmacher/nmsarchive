export const CATEGORIES = [
  "ship",
  "multitool",
  "freighter",
  "frigate",
  "companion",
  "wonder",
  "exosuit",
  "base",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Naves, MTs e pets: lista com slots vazios + drag-and-drop (PLAN §2.7.5). */
export const REORDERABLE_CATEGORIES = ["ship", "multitool", "companion"] as const;

export type ReorderableCategory = (typeof REORDERABLE_CATEGORIES)[number];

export const CATEGORY_META: Record<
  Category,
  { label: string; href: `/${Category}`; description: string }
> = {
  ship: {
    label: "Naves",
    href: "/ship",
    description:
      "Slots do save aberto (vazios visíveis, arraste para reordenar) e naves guardadas no arquivo.",
  },
  multitool: {
    label: "Multi-ferramentas",
    href: "/multitool",
    description: "Multi-tools do save (com vazios) e do arquivo pessoal.",
  },
  freighter: {
    label: "Cargueiras",
    href: "/freighter",
    description: "Cargueira atual e frota extra.",
  },
  frigate: {
    label: "Fragatas",
    href: "/frigate",
    description: "Frota de fragatas e traits.",
  },
  companion: {
    label: "Companions",
    href: "/companion",
    description: "Pets do save (com vazios) e do arquivo pessoal.",
  },
  wonder: {
    label: "Wonders",
    href: "/wonder",
    description: "Personal Wonders escolhidas pelo jogador.",
  },
  exosuit: {
    label: "Traje",
    href: "/exosuit",
    description:
      "Só slots liberados e posição das tecnologias — não o conteúdo de itens.",
  },
  base: {
    label: "Bases",
    href: "/base",
    description: "Bases planetárias, de nave e de cargueira.",
  },
};

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isReorderableCategory(
  value: string,
): value is ReorderableCategory {
  return (REORDERABLE_CATEGORIES as readonly string[]).includes(value);
}
