"use client";

import { useId, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadScreenshot } from "@/lib/screenshot-client";
import { screenshotPublicUrl } from "@/lib/screenshots";

export function ScreenshotField({
  path,
  onPathChange,
  disabled,
}: {
  path: string | null;
  onPathChange: (path: string | null) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const preview = screenshotPublicUrl(path);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const next = await uploadScreenshot(file);
      onPathChange(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao enviar a screenshot.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>Screenshot</Label>
      {preview ? (
        <div className="relative overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Screenshot do item"
            className="aspect-video w-full object-cover outline outline-1 outline-[oklch(0_0_0_/_0.1)] dark:outline-[oklch(1_0_0_/_0.1)]"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => onPathChange(null)}
            disabled={disabled || pending}
          >
            <X aria-hidden="true" />
            Remover foto
          </Button>
        </div>
      ) : null}
      <input
        id={inputId}
        type="file"
        accept="image/webp,image/jpeg,image/png,image/jpg"
        disabled={disabled || pending}
        aria-describedby={error ? errorId : hintId}
        aria-invalid={error ? true : undefined}
        className="min-h-11 w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm file:me-3 file:inline-flex file:h-7 file:rounded-md file:border-0 file:bg-muted file:px-2 file:text-sm file:font-medium"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onFile(file);
        }}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p id={hintId} className="text-xs text-muted-foreground">
          {pending ? (
            "Convertendo para WebP…"
          ) : (
            <>
              <ImagePlus className="me-1 inline size-3.5 align-text-bottom" aria-hidden="true" />
              JPEG, PNG ou WebP. Guardamos em WebP com no máximo 1 MB.
            </>
          )}
        </p>
      )}
    </div>
  );
}
