"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { slugifyTag, TAGS_MAX, tagLabelSchema } from "@/lib/validations";
import { cn } from "cn";

function normalizeLabel(raw: string): string | null {
  const parsed = tagLabelSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function TagInput({
  id,
  value,
  onChange,
  disabled,
  placeholder = "exotic",
  describedBy,
}: {
  id: string;
  value: string[];
  onChange: (labels: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  describedBy?: string;
}) {
  const listId = useId();
  const optionId = useId();
  const tags = trpc.items.listTags.useQuery({});
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedSlugs = useMemo(
    () => new Set(value.map((label) => slugifyTag(label))),
    [value],
  );

  const suggestions = useMemo(() => {
    const all = tags.data ?? [];
    const needle = draft.trim().toLowerCase();
    const slugNeedle = needle ? slugifyTag(needle) : "";
    return all
      .filter((tag) => !selectedSlugs.has(tag.slug))
      .filter((tag) => {
        if (!needle) return true;
        return (
          tag.slug.includes(slugNeedle) ||
          tag.label.toLowerCase().includes(needle)
        );
      })
      .slice(0, 8);
  }, [tags.data, draft, selectedSlugs]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function addLabel(raw: string) {
    const label = normalizeLabel(raw);
    if (!label) return;
    if (selectedSlugs.has(slugifyTag(label))) {
      setDraft("");
      return;
    }
    if (value.length >= TAGS_MAX) return;
    onChange([...value, label]);
    setDraft("");
    setActive(0);
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActive((n) => (n + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActive((n) => (n - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const picked = open ? suggestions[active] : undefined;
      if (picked) addLabel(picked.label);
      else addLabel(draft);
      setOpen(false);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if ((event.key === "," || event.key === ";") && draft.trim()) {
      event.preventDefault();
      addLabel(draft);
      setOpen(false);
      return;
    }
    if (event.key === "Backspace" && !draft && value.length) {
      event.preventDefault();
      removeAt(value.length - 1);
    }
  }

  const showList = open && suggestions.length > 0 && !disabled;

  return (
    <div ref={rootRef} className="relative grid gap-1.5">
      <div
        className={cn(
          "flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          "dark:bg-input/30",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {value.map((label, index) => (
          <span
            key={`${slugifyTag(label)}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 ps-2 pe-0.5 text-xs"
          >
            {label}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-6"
              aria-label={`Remover tag ${label}`}
              onClick={() => removeAt(index)}
            >
              <X aria-hidden="true" />
            </Button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled || value.length >= TAGS_MAX}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length ? undefined : placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList ? `${optionId}-${active}` : undefined
          }
          aria-describedby={describedBy}
          className="min-h-7 min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg bg-popover p-1 text-sm shadow-md ring-1 ring-foreground/10"
        >
          {suggestions.map((tag, index) => (
            <li
              key={tag.slug}
              id={`${optionId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1.5",
                index === active && "bg-muted",
              )}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                addLabel(tag.label);
                setOpen(false);
              }}
            >
              <span>{tag.label}</span>
              <span className="ms-2 text-xs text-muted-foreground">
                {tag.slug}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
