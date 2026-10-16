"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  APPLY_OVERLAY_MODES,
  applyTargetSlots,
  payloadTypeLabel,
  type ApplyDepth,
} from "@/lib/nms/extract/apply-depth";
import type { ExtractedSlot } from "@/lib/nms/extract/types";
import { asRecord, asString } from "@/lib/nms/value";
import { buildNmsItem, gameVersionMismatch, type NmsItemFile } from "@/lib/nmsitem";
import { screenshotPublicUrl } from "@/lib/screenshots";
import { trpc } from "@/lib/trpc";
import { getMappedJson, useSaveSession } from "@/stores/save-session";
import { isCategory } from "@/types/nms";
import { cn } from "cn";
import { VersionMismatchDialog } from "./version-mismatch-dialog";

function freighterRoleError(destIndex: number, payload: unknown): string | null {
  const kind = asString(asRecord(payload)?.kind);
  if (destIndex === 0 && kind !== "current") {
    return "Esta cargueira é da frota e não entra no slot Atual.";
  }
  if (destIndex !== 0 && kind === "current") {
    return "Esta cargueira é a atual e só entra no slot Atual.";
  }
  return null;
}

function slotCaption(slot: ExtractedSlot): string {
  const label = slot.slotLabel ?? String(slot.index + 1);
  const type = [slot.itemType, slot.className ? `Class ${slot.className}` : ""]
    .filter(Boolean)
    .join(" · ");
  const name = slot.empty ? "Slot vazio" : slot.name;
  return type ? `${name} · ${label} · ${type}` : `${name} · ${label}`;
}

type Draft = {
  key: string;
  target: "new" | "overlay";
  overlayIndex: number | null;
  depth: ApplyDepth;
  pickedId: string | null;
};

export function ApplyToSaveDialog({
  open,
  onOpenChange,
  sourceFile = null,
  destSlot = null,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceFile?: NmsItemFile | null;
  destSlot?: ExtractedSlot | null;
  onApplied?: (index: number) => void;
}) {
  const importItem = useSaveSession((s) => s.importItem);
  const sessionItems = useSaveSession((s) => s.items);
  const formKey = open
    ? `${sourceFile?.seed ?? ""}:${destSlot?.category ?? ""}:${destSlot?.index ?? ""}`
    : "";
  const [draft, setDraft] = useState<Draft>({
    key: "",
    target: "new",
    overlayIndex: null,
    depth: "model",
    pickedId: null,
  });
  const [pending, setPending] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [queued, setQueued] = useState<NmsItemFile | null>(null);

  const needsPicker = destSlot != null && sourceFile == null;
  const list = trpc.items.list.useQuery(
    { category: destSlot?.category },
    { enabled: open && needsPicker },
  );
  const detail = trpc.items.get.useQuery(
    { id: draft.pickedId ?? "" },
    { enabled: open && needsPicker && draft.pickedId != null },
  );

  const file: NmsItemFile | null = sourceFile
    ? sourceFile
    : detail.data && isCategory(detail.data.category)
      ? buildNmsItem({
          category: detail.data.category,
          name: detail.data.name,
          seed: detail.data.seed,
          payload: detail.data.payload,
          gameVersion: detail.data.gameVersion ?? 0,
          description: detail.data.description,
          tags: detail.data.tags.map((tag) => tag.label),
          galaxy: detail.data.galaxy ?? undefined,
        })
      : null;

  const category = file?.category ?? destSlot?.category ?? null;
  const slots =
    category && isCategory(category) ? (sessionItems[category] ?? []) : [];
  const targets =
    category && isCategory(category)
      ? applyTargetSlots(category, slots)
      : [];
  const filled = targets.filter((slot) => !slot.empty);
  const emptySlot = targets.find((slot) => slot.empty) ?? null;
  const canCreate = emptySlot != null;

  if (draft.key !== formKey) {
    const overlayIndex =
      destSlot && !destSlot.empty
        ? destSlot.index
        : (filled[0]?.index ?? null);
    setDraft({
      key: formKey,
      target: destSlot && !destSlot.empty ? "overlay" : canCreate ? "new" : "overlay",
      overlayIndex,
      depth: "model",
      pickedId: null,
    });
  }

  const overlaySlot =
    filled.find((slot) => slot.index === draft.overlayIndex) ??
    (destSlot && destSlot.index === draft.overlayIndex ? destSlot : null);
  const sourceType =
    file && isCategory(file.category)
      ? payloadTypeLabel(file.category, file.payload)
      : "";
  const destType = overlaySlot?.itemType ?? destSlot?.itemType ?? "";
  const typeChanges =
    draft.target === "overlay" &&
    destType !== "" &&
    sourceType !== "" &&
    destType !== sourceType;
  const roleError =
    draft.target === "overlay" &&
    (overlaySlot?.category === "freighter" || destSlot?.category === "freighter") &&
    file
      ? freighterRoleError(overlaySlot?.index ?? destSlot?.index ?? 0, file.payload)
      : null;

  const confirmDisabled =
    !file ||
    pending ||
    roleError != null ||
    (needsPicker && !detail.data) ||
    (draft.target === "new" && !canCreate) ||
    (draft.target === "overlay" && overlaySlot == null);

  async function commit(item: NmsItemFile) {
    setPending(true);
    try {
      const options =
        draft.target === "new"
          ? undefined
          : { index: overlaySlot?.index, depth: draft.depth };
      const index = await importItem(item, options);
      const destName = overlaySlot?.name ?? destSlot?.name;
      toast.success(
        draft.target === "new"
          ? `Criado no slot ${index + 1} do save aberto.`
          : draft.depth === "model"
            ? `Re-skin aplicado em ${destName ?? `slot ${index + 1}`}.`
            : `Trocado em ${destName ?? `slot ${index + 1}`}.`,
      );
      setMismatch(null);
      setQueued(null);
      onOpenChange(false);
      onApplied?.(index);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao aplicar");
    } finally {
      setPending(false);
    }
  }

  async function onConfirm() {
    if (!file || confirmDisabled) return;
    const json = getMappedJson();
    const warning = json ? gameVersionMismatch(file, json) : null;
    if (warning) {
      setQueued(file);
      setMismatch(warning);
      return;
    }
    await commit(file);
  }

  const pickingArchive = needsPicker;
  const title = destSlot && sourceFile == null ? "Importar modelo" : "Aplicar no save";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Criar no primeiro slot vazio, ou colocar em cima de um item do
              save. Inventário de naves e cargueiras fica vazio.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            {pickingArchive ? (
              list.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando arquivo…</p>
              ) : list.error ? (
                <p className="text-sm text-destructive">{list.error.message}</p>
              ) : list.data && list.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum item desta categoria no arquivo.
                </p>
              ) : (
                <div className="grid gap-2">
                  <p className="text-sm font-medium">Do arquivo</p>
                  {list.data?.items.map((archived) => {
                    const bits = [
                      archived.shipType,
                      archived.className ? `Class ${archived.className}` : "",
                    ].filter(Boolean);
                    const selected = archived.id === draft.pickedId;
                    const thumb = screenshotPublicUrl(archived.screenshotPath);
                    return (
                      <button
                        key={archived.id}
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left",
                          selected && "border-ring bg-muted/40",
                        )}
                        onClick={() =>
                          setDraft({ ...draft, pickedId: archived.id })
                        }
                      >
                        {selected ? (
                          thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              className="mb-2 aspect-video w-full rounded-lg object-cover outline outline-1 outline-[oklch(0_0_0_/_0.1)] dark:outline-[oklch(1_0_0_/_0.1)]"
                            />
                          ) : (
                            <div
                              className="mb-2 aspect-video w-full rounded-lg bg-muted/40"
                              aria-hidden="true"
                            />
                          )
                        ) : null}
                        <span className="block text-sm font-medium">
                          {archived.name}
                        </span>
                        {bits.length > 0 ? (
                          <span className="block text-sm text-muted-foreground">
                            {bits.join(" · ")}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )
            ) : null}

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Destino</legend>
              <button
                type="button"
                aria-pressed={draft.target === "new"}
                disabled={!canCreate}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left disabled:opacity-50",
                  draft.target === "new" && "border-ring bg-muted/40",
                )}
                onClick={() => setDraft({ ...draft, target: "new" })}
              >
                <span className="block text-sm font-medium">
                  Criar no primeiro slot vazio
                </span>
                <span className="block text-sm text-muted-foreground">
                  {canCreate
                    ? `Entra em ${slotCaption(emptySlot)}.`
                    : "Não há slot vazio nesta categoria."}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={draft.target === "overlay"}
                disabled={filled.length === 0}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left disabled:opacity-50",
                  draft.target === "overlay" && "border-ring bg-muted/40",
                )}
                onClick={() => setDraft({ ...draft, target: "overlay" })}
              >
                <span className="block text-sm font-medium">
                  Colocar em cima de uma existente
                </span>
                <span className="block text-sm text-muted-foreground">
                  {filled.length === 0
                    ? "Nenhum item preenchido neste save."
                    : "Escolha o slot e se é re-skin ou troca completa."}
                </span>
              </button>
            </fieldset>

            {draft.target === "overlay" && filled.length > 0 ? (
              <div className="grid gap-2">
                <label htmlFor="apply-overlay-slot" className="text-sm font-medium">
                  Slot
                </label>
                <select
                  id="apply-overlay-slot"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  value={draft.overlayIndex ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      overlayIndex: Number(event.target.value),
                    })
                  }
                >
                  {filled.map((slot) => (
                    <option key={slot.index} value={slot.index}>
                      {slotCaption(slot)}
                    </option>
                  ))}
                </select>
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Como aplicar</legend>
                  {APPLY_OVERLAY_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={draft.depth === mode.id}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left",
                        draft.depth === mode.id && "border-ring bg-muted/40",
                      )}
                      onClick={() => setDraft({ ...draft, depth: mode.id })}
                    >
                      <span className="block text-sm font-medium">{mode.label}</span>
                      <span className="block text-sm text-muted-foreground">
                        {mode.hint}
                      </span>
                    </button>
                  ))}
                </fieldset>
              </div>
            ) : null}

            {typeChanges && overlaySlot ? (
              <p className="text-sm">
                {destType} passa a ser {sourceType}.
                {draft.depth === "model"
                  ? " A tech que ficar neste slot pode não servir no tipo novo."
                  : " Slots e tecnologias vêm da origem."}
              </p>
            ) : null}
            {roleError ? (
              <p className="text-sm text-destructive">{roleError}</p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void onConfirm()}
              disabled={confirmDisabled}
            >
              {pending
                ? "Aplicando…"
                : destSlot && sourceFile == null
                  ? "Importar"
                  : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <VersionMismatchDialog
        open={queued != null}
        warning={mismatch}
        onCancel={() => {
          setQueued(null);
          setMismatch(null);
        }}
        onConfirm={() => {
          if (queued) void commit(queued);
        }}
      />
    </>
  );
}
