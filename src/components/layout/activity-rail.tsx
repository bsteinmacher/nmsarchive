"use client";

import { useEffect, useId, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { SaveActionsMenu } from "@/components/save/save-actions-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSaveSession } from "@/stores/save-session";
import {
  sessionActivityLabel,
  setActivityRailOpen,
  useActivityRailOpen,
  useSessionActivity,
  type SessionActivityEvent,
} from "@/stores/session-activity";

const RAIL_EXPANDED = "w-80";
const RAIL_COLLAPSED = "w-12";

function formatWhen(date: Date) {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isLifecycle(kind: SessionActivityEvent["kind"]) {
  return kind === "open" || kind === "save" || kind === "cancel";
}

function SessionEntry({ event }: { event: SessionActivityEvent }) {
  const label = sessionActivityLabel(event);
  if (isLifecycle(event.kind)) {
    return (
      <li className="grid gap-1.5 px-2 py-2">
        <div role="separator" className="border-t border-border" />
        <p className="text-center text-sm">{label}</p>
        <time
          className="text-center text-xs text-muted-foreground"
          dateTime={event.at.toISOString()}
        >
          {formatWhen(event.at)}
        </time>
      </li>
    );
  }
  return (
    <li className="rounded-lg px-2 py-1.5 text-sm">
      <p>{label}</p>
      <time
        className="text-xs text-muted-foreground"
        dateTime={event.at.toISOString()}
      >
        {formatWhen(event.at)}
      </time>
    </li>
  );
}

function ActivityFeed() {
  const session = useSessionActivity();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [session]);

  return (
    <div
      ref={scrollerRef}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
    >
      {session.length === 0 ? (
        <p className="mt-auto px-3 py-2 text-sm text-muted-foreground">
          Nenhuma alteração nesta sessão.
        </p>
      ) : (
        <ol className="mt-auto flex flex-col gap-0.5 p-3">
          {session.map((event) => (
            <SessionEntry key={event.id} event={event} />
          ))}
        </ol>
      )}
    </div>
  );
}

function RailBody({ headingId }: { headingId: string }) {
  const ready = useSaveSession((s) => s.status === "ready");

  return (
    <>
      <h2 id={headingId} className="sr-only">
        Atividade da sessão
      </h2>
      <ActivityFeed />
      <div className="grid shrink-0 gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <SaveActionsMenu />
        {!ready ? (
          <p className="text-xs text-muted-foreground">
            Abra um save para gravar as alterações no jogo.
          </p>
        ) : null}
      </div>
    </>
  );
}

function RailToggle({
  open,
  dirty,
  controlsId,
}: {
  open: boolean;
  dirty: boolean;
  controlsId?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-expanded={open}
      aria-controls={controlsId}
      aria-label={
        dirty
          ? open
            ? "Recolher atividade. Há alterações não salvas."
            : "Abrir atividade. Há alterações não salvas."
          : open
            ? "Recolher atividade"
            : "Abrir atividade"
      }
      onClick={() => setActivityRailOpen(!open)}
    >
      <span className="relative">
        {open ? (
          <ChevronRight aria-hidden="true" />
        ) : (
          <ChevronLeft aria-hidden="true" />
        )}
        {dirty ? (
          <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
        ) : null}
      </span>
    </Button>
  );
}

export function ActivityRailTrigger() {
  const open = useActivityRailOpen();
  const dirty = useSaveSession((s) => s.dirty);
  return <RailToggle open={open} dirty={dirty} />;
}

export function ActivityRail() {
  const isMobile = useIsMobile();
  const dirty = useSaveSession((s) => s.dirty);
  const headingId = useId();
  const panelId = useId();
  const open = useActivityRailOpen();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setActivityRailOpen}>
        <SheetContent
          id={panelId}
          side="right"
          showCloseButton={false}
          className="gap-0 p-0 sm:max-w-sm"
        >
          <SheetTitle className="sr-only">Atividade da sessão</SheetTitle>
          <SheetDescription className="sr-only">
            Alterações do save aberto e gravação.
          </SheetDescription>
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
              <RailToggle open={open} dirty={dirty} controlsId={panelId} />
              <span className="font-heading text-sm font-medium">
                Atividade
              </span>
            </div>
            <RailBody headingId={headingId} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      data-state={open ? "expanded" : "collapsed"}
      className={cn(
        "hidden h-svh shrink-0 flex-col border-l bg-sidebar text-sidebar-foreground md:flex",
        "motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear",
        open ? RAIL_EXPANDED : RAIL_COLLAPSED,
      )}
    >
      <div
        className={cn(
          "flex h-12 shrink-0 items-center gap-2 overflow-hidden px-2",
          !open && "justify-center",
        )}
      >
        <RailToggle open={open} dirty={dirty} controlsId={panelId} />
        <span
          className={cn(
            "font-heading text-sm font-medium",
            !open && "sr-only",
          )}
        >
          Atividade
        </span>
      </div>
      <div
        id={panelId}
        aria-labelledby={headingId}
        aria-hidden={!open}
        inert={!open ? true : undefined}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          !open && "invisible w-0",
        )}
      >
        <RailBody headingId={headingId} />
      </div>
    </aside>
  );
}
