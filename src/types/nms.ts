export const CATEGORIES = [
  "ship",
  "multitool",
  "freighter",
  "frigate",
  "companion",
  "wonder",
  "exosuit",
  "inventory",
  "base",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<
  Category,
  { label: string; href: `/${Category}`; description: string }
> = {
  ship: {
    label: "Naves",
    href: "/ship",
    description: "Starships do save carregado e do arquivo pessoal.",
  },
  multitool: {
    label: "Multi-ferramentas",
    href: "/multitool",
    description: "Multi-tools ativas e arquivadas in-game.",
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
    description: "Pets e criaturas domesticadas.",
  },
  wonder: {
    label: "Wonders",
    href: "/wonder",
    description: "Personal Wonders escolhidas pelo jogador.",
  },
  exosuit: {
    label: "Traje",
    href: "/exosuit",
    description: "Inventários do exosuit (geral, tech e cargo).",
  },
  inventory: {
    label: "Inventário",
    href: "/inventory",
    description: "Itens e recursos armazenados.",
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
