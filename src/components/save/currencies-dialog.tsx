"use client";

import { useId, useState, type FormEvent } from "react";
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

const FIELD_META: Record<
  CurrencyField,
  { label: string; verb: string }
> = {
  units: { label: "Units", verb: "Salvar Units" },
  nanites: { label: "Nanites", verb: "Salvar Nanites" },
  specials: { label: "Quicksilver", verb: "Salvar Quicksilver" },
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
  const summary = useSaveSession((s) => s.summary);
  const updateCurrencies = useSaveSession((s) => s.updateCurrencies);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [fieldKey, setFieldKey] = useState<CurrencyField | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const meta = field ? FIELD_META[field] : null;
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
    if (!field || !meta) return;
    const parsedValue = parseInteger(value);
    if (parsedValue == null) {
      setError(`Use um número inteiro para ${meta.label}.`);
      document.getElementById(inputId)?.focus();
      return;
    }
    try {
      await updateCurrencies({ [field]: parsedValue });
      toast.success(
        `${meta.label} atualizado neste save. Use “Baixar save” para levar o .hg ao jogo.`,
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gravar");
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
          <DialogTitle>Editar {meta?.label ?? "moeda"}</DialogTitle>
          <DialogDescription>
            Só este valor. Fica no save aberto até você baixar o .hg.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-2">
            <Label htmlFor={inputId}>{meta?.label ?? "Valor"}</Label>
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
                No jogo vai de {UNITS_MIN.toLocaleString("pt-BR")} a{" "}
                {UNITS_MAX.toLocaleString("pt-BR")} (cerca de 4,29 bilhões).
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
                  Fora do intervalo do jogo (0 a{" "}
                  {UNITS_MAX.toLocaleString("pt-BR")}).
                </span>
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void commit()}>
              {meta?.verb ?? "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
