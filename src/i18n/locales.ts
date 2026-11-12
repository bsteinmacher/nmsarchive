export const locales = ["pt-BR"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "pt-BR";

export const localeCookie = "locale";

export const localeLabels: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
};

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
