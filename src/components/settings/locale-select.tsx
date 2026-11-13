"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { localeLabels, locales } from "@/i18n/locales";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

const selectClass = cn(
  "h-8 w-full min-h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
);

export function LocaleSelect() {
  const locale = useLocale();
  const t = useTranslations("settings");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <div className="grid max-w-xs gap-1.5">
      <Label htmlFor="app-locale">{t("localeLabel")}</Label>
      <select
        id="app-locale"
        className={selectClass}
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          setPending(true);
          void (async () => {
            await setLocale(next);
            router.refresh();
            setPending(false);
          })();
        }}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
