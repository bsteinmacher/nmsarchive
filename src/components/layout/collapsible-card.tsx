"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "cn";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";

type CollapsibleCardProps = {
  title: ReactNode;
  description?: ReactNode;
  expandLabel: string;
  collapseLabel: string;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  contentClassName?: string;
  children: ReactNode;
};

export function CollapsibleCard({
  title,
  description,
  expandLabel,
  collapseLabel,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  contentClassName,
  children,
}: CollapsibleCardProps) {
  const panelId = useId();
  const [internal, setInternal] = useState(defaultExpanded);
  const expanded = expandedProp ?? internal;

  function toggle() {
    const next = !expanded;
    if (expandedProp === undefined) setInternal(next);
    onExpandedChange?.(next);
  }

  return (
    <Card className={cn(!expanded && "py-0")}>
      <button
        type="button"
        data-slot="card-header"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        aria-label={expanded ? collapseLabel : expandLabel}
        className={cn(
          "group/card-header @container/card-header grid w-full auto-rows-min items-start gap-1 px-(--card-spacing) text-start",
          "has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
          "cursor-pointer bg-transparent text-inherit outline-none select-none",
          "hover:bg-muted/40",
          "focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
          expanded
            ? "rounded-t-xl border-x-0 border-t-0 border-b border-border pb-(--card-spacing)"
            : "rounded-xl border-0 py-(--card-spacing)",
        )}
        onClick={toggle}
      >
        <CardTitle>{title}</CardTitle>
        {expanded && description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
        <CardAction>
          {expanded ? (
            <ChevronUp
              aria-hidden="true"
              className="mt-0.5 size-4 text-muted-foreground"
            />
          ) : (
            <ChevronDown
              aria-hidden="true"
              className="mt-0.5 size-4 text-muted-foreground"
            />
          )}
        </CardAction>
      </button>
      {expanded ? (
        <CardContent id={panelId} className={contentClassName}>
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
