"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSaveSession } from "@/stores/save-session";

export function UploadDropzone() {
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
        toast.success(`Save carregado: ${file.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao ler o save");
      }
    },
    [loadFile],
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
        {loading
          ? "Decodificando LZ4 e aplicando mapping no worker…"
          : "Solte um save.hg aqui ou escolha o arquivo. Nada é enviado ao servidor."}
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
        Escolher save.hg
      </Button>
      <p className="text-xs">
        Fixture local de testes: <code>.others/save2.hg</code> (gitignored)
      </p>
    </div>
  );
}
