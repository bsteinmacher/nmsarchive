import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, hasLocale, localeCookie, type Locale } from "@/i18n/locales";

async function loadMessages(locale: Locale) {
  switch (locale) {
    case "pt-BR":
      return {
        common: (await import("../../messages/pt-BR/common.json")).default,
        nav: (await import("../../messages/pt-BR/nav.json")).default,
        archive: (await import("../../messages/pt-BR/archive.json")).default,
        save: (await import("../../messages/pt-BR/save.json")).default,
        settings: (await import("../../messages/pt-BR/settings.json")).default,
      };
  }
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const requested = store.get(localeCookie)?.value;
  const locale = requested && hasLocale(requested) ? requested : defaultLocale;
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "America/Sao_Paulo",
  };
});
