"use server";

import { cookies } from "next/headers";
import { hasLocale, localeCookie } from "@/i18n/locales";

const YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(locale: string) {
  if (!hasLocale(locale)) return;
  const store = await cookies();
  store.set(localeCookie, locale, {
    path: "/",
    maxAge: YEAR_SECONDS,
    sameSite: "lax",
  });
}
