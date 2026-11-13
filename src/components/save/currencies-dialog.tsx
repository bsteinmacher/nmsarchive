"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useIntegerFormat } from "@/i18n/format";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UNITS_MAX,
  UNITS_MIN,
  unitsOutsideRange,
  type PlayerCurrencies,
} from "@/lib/nms/write";
import { useSaveSession } from "@/stores/save-session";

export type CurrencyField = keyof PlayerCurrencies;

const FIELD_KEYS: Record<CurrencyField, "units" | "nanites" | "quicksilver"> = {
  units: "units",
  nanites: "nanites",
  specials: "quicksilver",
};

const VERB_KEYS: Record<CurrencyField, "saveUnits" | "saveNanites" | "saveQuicksilver"> = {
  units: "saveUnits",
  nanites: "saveNanites",
  specials: "saveQuicksilver",
};

function parseInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

export function CurrencyEditDialog({
  field,
  onClose,
}: {
  field: CurrencyField | null;
  onClose: () => void;
}) {
  const t = useTranslations("save");
  const common = useTranslations("common");
  const formatInteger = useIntegerFormat();
  const summary = useSaveSession((s) => s.summary);
  const updateCurrencies = useSaveSession((s) => s.updateCurrencies);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [fieldKey, setFieldKey] = useState<CurrencyField | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const label = field ? t(FIELD_KEYS[field]) : null;
  const verb = field ? t(VERB_KEYS[field]) : common("save");
  const parsed = parseInteger(value);
  const unitsOutOfRange =
    field === "units" && parsed != null && unitsOutsideRange(parsed);

  if (field && summary && field !== fieldKey) {
    setFieldKey(field);
    setValue(String(summary[field]));
    setError(null);
  }
  if (!field && fieldKey != null) {
    setFieldKey(null);
  }

  async function commit() {
    if (!field || !label) return;
    const parsedValue = parseInteger(value);
    if (parsedValue == null) {
      setError(t("integerRequired", { label }));
      document.getElementById(inputId)?.focus();
      return;
    }
    try {
      await updateCurrencies({ [field]: parsedValue });
      toast.success(t("currencySaved", { label }));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : common("failWrite"));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await commit();
  }

  return (
    <Dialog
      open={field != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("currencyTitle", { label: label ?? t("currencyFallback") })}
          </DialogTitle>
          <DialogDescription>{t("currencyBody")}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-2">
            <Label htmlFor={inputId}>{label ?? t("value")}</Label>
            <Input
              id={inputId}
              name={field ?? "currency"}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={
                field === "units"
                  ? `${hintId}${error ? ` ${errorId}` : ""}`
                  : error
                    ? errorId
                    : undefined
              }
            />
            {field === "units" ? (
              <p id={hintId} className="text-xs text-muted-foreground">
                {t("unitsRange", {
                  min: formatInteger(UNITS_MIN),
                  max: formatInteger(UNITS_MAX),
                })}
              </p>
            ) : null}
            {error ? (
              <p id={errorId} className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {unitsOutOfRange ? (
              <p
                role="status"
                className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {t("unitsOut", { max: formatInteger(UNITS_MAX) })}
                </span>
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {common("cancel")}
            </Button>
            <Button type="button" onClick={() => void commit()}>
              {verb}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
