"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSaveSession } from "@/stores/save-session";

export function UploadDropzone() {
  const t = useTranslations("save");
  const common = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const loadFile = useSaveSession((s) => s.loadFile);
  const status = useSaveSession((s) => s.status);
  const [drag, setDrag] = useState(false);
  const loading = status === "loading";

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        await loadFile(file);
        toast.success(t("saveLoaded", { name: file.name }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : common("failReadSave"));
      }
    },
    [common, loadFile, t],
  );

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void onFile(e.dataTransfer.files[0]);
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center text-sm ${
        drag ? "border-primary bg-muted/40" : "text-muted-foreground"
      }`}
    >
      {loading ? (
        <Loader2 className="size-6 animate-spin" />
      ) : (
        <Upload className="size-6" />
      )}
      <p>
        {loading ? t("decoding") : t("dropSave")}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".hg,.json,application/octet-stream"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {t("chooseSave")}
      </Button>
    </div>
  );
}
