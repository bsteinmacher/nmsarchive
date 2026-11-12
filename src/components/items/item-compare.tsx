"use client";

import { Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useColumnHeader } from "@/i18n/format";
import { gameTermLabel } from "@/i18n/game-terms";
import {
  jsonDiff,
  jsonDiffHasChanges,
  previewDiffValue,
  shallowItemDiff,
  type JsonDiffNode,
} from "@/lib/item-compare";

type ComparePayload = {
  seed: string;
  className: string;
  itemType: string;
  payload: unknown;
};

function DiffTree({ node }: { node: JsonDiffNode }) {
  const t = useTranslations("archive");
  const children = node.children ?? [];
  const changed = children.filter((child) => child.kind !== "same");
  const hidden = children.length - changed.length;
  const kindLabel =
    node.kind === "changed"
      ? t("different")
      : node.kind === "only-archived"
        ? t("onlyArchive")
        : node.kind === "only-save"
          ? t("onlySave")
          : t("same");

  if (!children.length) {
    return (
      <div className="ml-2">
        <span className="text-foreground">{node.key}</span>{" "}
        <span className="text-muted-foreground">({kindLabel})</span>
        {node.kind === "changed" ? (
          <div className="ml-2 text-muted-foreground">
            {t("archiveToSave", {
              archived: previewDiffValue(node.archived),
              save: previewDiffValue(node.save),
            })}
          </div>
        ) : (
          <span className="ml-1">
            {previewDiffValue(node.archived ?? node.save)}
          </span>
        )}
      </div>
    );
  }

  return (
    <details className="ml-2" open={node.kind !== "same"}>
      <summary className="cursor-pointer select-none text-muted-foreground">
        <span className="text-foreground">{node.key}</span> {kindLabel}
        {hidden > 0 ? t("hiddenSame", { count: hidden }) : null}
      </summary>
      <div className="border-s ps-2">
        {changed.map((child) => (
          <DiffTree key={child.key} node={child} />
        ))}
      </div>
    </details>
  );
}

export function ItemCompare({
  archived,
  save,
  saveLabel,
}: {
  archived: ComparePayload;
  save: ComparePayload;
  saveLabel?: string;
}) {
  const t = useTranslations("archive");
  const header = useColumnHeader();
  const rows = shallowItemDiff(archived, save);
  const diff = jsonDiff(archived.payload, save.payload);
  const hasJsonChanges = jsonDiffHasChanges(diff);

  return (
    <section className="grid gap-3" aria-labelledby="compare-heading">
      <div>
        <h3 id="compare-heading" className="font-heading text-sm font-medium">
          {t("compareTitle")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {saveLabel
            ? t("compareNamed", { label: saveLabel })
            : t("compareDefault")}
        </p>
      </div>
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li
            key={row.field}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
          >
            <span className="inline-flex items-center gap-2">
              {row.match ? (
                <Check
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <Minus
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span className="font-medium">
                {header({ id: row.field, header: row.label })}
              </span>
              <span className="text-xs text-muted-foreground">
                {row.match ? t("same") : t("different")}
              </span>
            </span>
            <span className="font-mono text-xs break-all text-muted-foreground">
              {t("archiveAndSave", {
                archived:
                  row.field === "itemType" ? gameTermLabel(row.archived) : row.archived,
                save: row.field === "itemType" ? gameTermLabel(row.save) : row.save,
              })}
            </span>
          </li>
        ))}
      </ul>
      <details className="rounded-lg border bg-muted/20 px-3 py-2">
        <summary className="cursor-pointer select-none text-sm font-medium">
          {t("jsonDiff")}
        </summary>
        <div className="mt-2 max-h-[40vh] overflow-auto font-mono text-xs">
          {hasJsonChanges ? (
            <DiffTree node={diff} />
          ) : (
            <p className="text-muted-foreground">{t("payloadsEqual")}</p>
          )}
        </div>
      </details>
    </section>
  );
}
