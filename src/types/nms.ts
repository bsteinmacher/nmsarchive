export const CATEGORIES = [
  "exosuit",
  "multitool",
  "companion",
  "ship",
  "freighter",
  "frigate",
  "base",
  "deepspace",
  "spacestation",
  "wonder",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Naves, MTs, pets e fragatas: lista com slots vazios + drag-and-drop. */
export const REORDERABLE_CATEGORIES = [
  "ship",
  "multitool",
  "companion",
  "frigate",
] as const;

export type ReorderableCategory = (typeof REORDERABLE_CATEGORIES)[number];

/** Itens do menu. Slugs extras (frigate, deepspace, spacestation) continuam em CATEGORIES. */
export const SIDEBAR_CATEGORIES = [
  "exosuit",
  "multitool",
  "companion",
  "ship",
  "freighter",
  "base",
  "wonder",
] as const satisfies readonly Category[];

export const CATEGORY_META: Record<
  Category,
  { label: string; href: `/${Category}`; description: string }
> = {
  ship: {
    label: "Ships",
    href: "/ship",
    description:
      "Slots do save aberto (vazios visíveis, arraste para reordenar) e Ships no arquivo.",
  },
  multitool: {
    label: "Multi Tools",
    href: "/multitool",
    description: "Multi Tools do save (com vazios) e do arquivo pessoal.",
  },
  freighter: {
    label: "Freighters",
    href: "/freighter",
    description: "Freighter atual, a base do interior e a frota de Frigates.",
  },
  frigate: {
    label: "Frigates",
    href: "/frigate",
    description:
      "Frota de Frigates (até 30). O save só lista as que existem — não há slots vazios pré-alocados.",
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
    label: "Exosuit",
    href: "/exosuit",
    description:
      "Só slots liberados e posição das tecnologias — não o conteúdo de itens.",
  },
  base: {
    label: "Bases",
    href: "/base",
    description:
      "Planet Bases, Deep Space e Space Stations. A base da Freighter fica em Freighters.",
  },
  deepspace: {
    label: "Deep Space Bases",
    href: "/deepspace",
    description:
      "Bases orbitais livres (COSMOS). Mesmo array das bases planetárias; não há limite separado no JSON.",
  },
  spacestation: {
    label: "Space Stations",
    href: "/spacestation",
    description:
      "Estação espacial reivindicada (COSMOS). Até 20 por save; a 21ª é recusada na hora de aplicar.",
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

export function archiveHref(
  category?: Category,
): "/" | `/archive/${Category}` {
  if (!category) return "/";
  if (category === "frigate") return "/archive/freighter";
  if (category === "deepspace" || category === "spacestation") {
    return "/archive/base";
  }
  return `/archive/${category}`;
}

export function saveHref(category: Category): `/${Category}` {
  if (category === "frigate") return "/freighter";
  if (category === "deepspace" || category === "spacestation") return "/base";
  return CATEGORY_META[category].href;
}
