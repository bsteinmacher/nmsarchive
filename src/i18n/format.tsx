"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Category } from "@/types/nms";

const SHORT_DATE = {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
} as const;

const MEDIUM_DATE = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
} as const;

export function useShortDateTime() {
  const format = useFormatter();
  return (input: Date | string | number) => {
    const date = input instanceof Date ? input : new Date(input);
    return format.dateTime(date, SHORT_DATE);
  };
}

export function useMediumDateTime() {
  const format = useFormatter();
  return (input: Date | string | number) => {
    const date = input instanceof Date ? input : new Date(input);
    return format.dateTime(date, MEDIUM_DATE);
  };
}

export function useIntegerFormat() {
  const format = useFormatter();
  return (value: number) => format.number(value);
}

export function useCategoryCopy() {
  const t = useTranslations("nav.categories");
  return {
    label: (category: Category | string) => t(`${category}.label`),
    description: (category: Category | string) => t(`${category}.description`),
  };
}

export function columnMessageKey(col: { id: string; header: string }) {
  if (col.id === "className" && col.header === "Rank") return "rank";
  return col.id;
}

export function useColumnHeader() {
  const t = useTranslations("archive.columns");
  return (col: { id: string; header: string }) => {
    const key = columnMessageKey(col);
    return t.has(key) ? t(key) : col.header;
  };
}
