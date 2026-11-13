"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { gameTermLabel } from "@/i18n/game-terms";
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
  applyPartOptions,
  applyTargetSlots,
  defaultApplyParts,
  payloadTypeLabel,
  usesApplyDepth,
  type ApplyDepth,
  type ApplyParts,
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

function freighterRoleError(
  destIndex: number,
  payload: unknown,
  fleet: string,
  current: string,
): string | null {
  const kind = asString(asRecord(payload)?.kind);
  if (destIndex === 0 && kind !== "current") return fleet;
  if (destIndex !== 0 && kind === "current") return current;
  return null;
}

function slotCaption(
  slot: ExtractedSlot,
  emptyLabel: string,
  classLabel: (value: string) => string,
): string {
  const label = slot.slotLabel ?? String(slot.index + 1);
  const type = [
    slot.itemType ? gameTermLabel(slot.itemType) : "",
    slot.className ? classLabel(slot.className) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const name = slot.empty ? emptyLabel : slot.name;
  return type ? `${name} · ${label} · ${type}` : `${name} · ${label}`;
}

type Draft = {
  key: string;
  target: "new" | "overlay";
  overlayIndex: number | null;
  depth: ApplyDepth;
  parts: ApplyParts;
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
  const t = useTranslations("archive");
  const common = useTranslations("common");
  const caption = (slot: ExtractedSlot) =>
    slotCaption(slot, t("emptySlot"), (value) => common("classValue", { value }));
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
    parts: defaultApplyParts("ship"),
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
      parts: defaultApplyParts(
        category && usesApplyDepth(category) ? category : "ship",
      ),
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
      ? freighterRoleError(
          overlaySlot?.index ?? destSlot?.index ?? 0,
          file.payload,
          t("fleetFreighter"),
          t("currentFreighter"),
        )
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
          : {
              index: overlaySlot?.index,
              depth: draft.depth,
              ...(category &&
              usesApplyDepth(category) &&
              draft.depth === "model"
                ? { parts: draft.parts }
                : {}),
            };
      const index = await importItem(item, options);
      const destName = overlaySlot?.name ?? destSlot?.name;
      const slotName = destName ?? t("slotRef", { slot: index + 1 });
      toast.success(
        draft.target === "new"
          ? t("createdInSlot", { slot: index + 1 })
          : category && usesApplyDepth(category) && draft.depth === "model"
            ? t("reskinApplied", { slot: slotName })
            : category && usesApplyDepth(category)
              ? t("swappedAt", { slot: slotName })
              : t("appliedAt", { slot: slotName }),
      );
      setMismatch(null);
      setQueued(null);
      onOpenChange(false);
      onApplied?.(index);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : common("failApply"));
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
  const title = destSlot && sourceFile == null ? t("importModel") : t("applyTitle");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {category === "squadron" ? t("squadronApply") : t("defaultApply")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            {pickingArchive ? (
              list.isLoading ? (
                <p className="text-sm text-muted-foreground">{common("loadingArchive")}</p>
              ) : list.error ? (
                <p className="text-sm text-destructive">{list.error.message}</p>
              ) : list.data && list.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noneInCategory")}
                </p>
              ) : (
                <div className="grid gap-2">
                  <p className="text-sm font-medium">{t("fromArchive")}</p>
                  {list.data?.items.map((archived) => {
                    const bits = [
                      archived.shipType ? gameTermLabel(archived.shipType) : "",
                      archived.className
                        ? common("classValue", { value: archived.className })
                        : "",
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
              <legend className="text-sm font-medium">{t("destination")}</legend>
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
                  {t("createEmpty")}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {canCreate && emptySlot
                    ? t("entersSlot", { slot: caption(emptySlot) })
                    : t("noEmptySlot")}
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
                  {t("overlayExisting")}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {filled.length === 0
                    ? t("noneFilled")
                    : category === "squadron"
                      ? t("squadronOverlay")
                      : t("chooseDepth")}
                </span>
              </button>
            </fieldset>

            {draft.target === "overlay" && filled.length > 0 ? (
              <div className="grid gap-2">
                <label htmlFor="apply-overlay-slot" className="text-sm font-medium">
                  {common("slot")}
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
                      {caption(slot)}
                    </option>
                  ))}
                </select>
                {category && usesApplyDepth(category) ? (
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">{t("howToApply")}</legend>
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
                      <span className="block text-sm font-medium">
                        {mode.id === "model" ? t("reskin") : t("swap")}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {mode.id === "model" ? t("reskinHint") : t("swapHint")}
                      </span>
                    </button>
                  ))}
                  {draft.depth === "model" ? (
                    <div className="grid gap-2 pt-1">
                      <p className="text-sm font-medium">{t("whatToTake")}</p>
                      <div className="grid gap-1.5">
                        {applyPartOptions(category).map((part) => (
                          <label
                            key={part.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={draft.parts[part.id]}
                              onChange={() =>
                                setDraft({
                                  ...draft,
                                  parts: {
                                    ...draft.parts,
                                    [part.id]: !draft.parts[part.id],
                                  },
                                })
                              }
                            />
                            {t(
                              part.id === "name"
                                ? "partName"
                                : part.id === "model"
                                  ? "partModel"
                                  : part.id === "class"
                                    ? "partClass"
                                    : part.id === "slots"
                                      ? "partSlots"
                                      : part.id === "inventory"
                                        ? "partInventory"
                                        : part.id === "technologies"
                                          ? "partTech"
                                          : "partOrigin",
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </fieldset>
                ) : null}
              </div>
            ) : null}

            {typeChanges && overlaySlot ? (
              <p className="text-sm">
                {t("typeBecomes", {
                  dest: gameTermLabel(destType),
                  source: gameTermLabel(sourceType),
                })}
                {draft.depth === "model" ? t("techMayNotFit") : t("slotsFromOrigin")}
              </p>
            ) : null}
            {roleError ? (
              <p className="text-sm text-destructive">{roleError}</p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void onConfirm()}
              disabled={confirmDisabled}
            >
              {pending
                ? common("applying")
                : destSlot && sourceFile == null
                  ? common("import")
                  : common("apply")}
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
