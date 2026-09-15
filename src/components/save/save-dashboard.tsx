"use client";

import { useRef, useState } from "react";
import { Download, FileJson, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadBytes } from "@/lib/download";
import { formatPlayTime } from "@/lib/nms/player";
import { gameVersionMismatch, parseNmsItem } from "@/lib/nmsitem";
import { downloadNmsItemZip } from "@/lib/nmsitem-zip";
import { getMappedJson, useSaveSession } from "@/stores/save-session";
import { CurrencyEditDialog, type CurrencyField } from "./currencies-dialog";
import { UploadDropzone } from "./upload-dropzone";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function CurrencyStat({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`Editar ${label}`}
          className="text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" className="size-3" />
        </Button>
      </div>
      <p className="font-heading text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

export function SaveDashboard() {
  const status = useSaveSession((s) => s.status);
  const summary = useSaveSession((s) => s.summary);
  const fileName = useSaveSession((s) => s.fileName);
  const mappingVersion = useSaveSession((s) => s.mappingVersion);
  const unknownKeys = useSaveSession((s) => s.unknownKeys);
  const error = useSaveSession((s) => s.error);
  const clear = useSaveSession((s) => s.clear);
  const importItem = useSaveSession((s) => s.importItem);
  const exportAllShips = useSaveSession((s) => s.exportAllShips);
  const downloadRewritten = useSaveSession((s) => s.downloadRewritten);
  const downloadOriginal = useSaveSession((s) => s.downloadOriginal);
  const importRef = useRef<HTMLInputElement>(null);
  const [pendingItem, setPendingItem] = useState<ReturnType<
    typeof parseNmsItem
  > | null>(null);
  const [versionWarning, setVersionWarning] = useState<string | null>(null);
  const [editingCurrency, setEditingCurrency] = useState<CurrencyField | null>(
    null,
  );

  async function commitImport(item: ReturnType<typeof parseNmsItem>) {
    try {
      const index = await importItem(item);
      toast.success(`Item importado no slot ${index + 1}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no import");
    } finally {
      setPendingItem(null);
      setVersionWarning(null);
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const item = parseNmsItem(await file.text());
      const json = getMappedJson();
      const warning = json ? gameVersionMismatch(item, json) : null;
      if (warning) {
        setPendingItem(item);
        setVersionWarning(warning);
        return;
      }
      await commitImport(item);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Arquivo inválido");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Save aberto
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sessão deste browser: abrir um .hg, conferir moedas e galáxia, copiar
          itens para o arquivo. O JSON fica no IndexedDB; o servidor só recebe o
          item arquivado, nunca o .hg.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carregar save</CardTitle>
          <CardDescription>
            Steam/GOG <code>save*.hg</code>. O <code>mf_save</code> é opcional e
            não é lido no MVP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <UploadDropzone />
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>

      {status === "ready" && summary ? (
        <>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>{summary.saveName || fileName || "Save"}</CardTitle>
              <CardDescription>
                {summary.saveSummary || "Sem SaveSummary"} · mapping{" "}
                {mappingVersion}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Galáxia" value={summary.galaxyLabel} />
              <Stat label="Tempo de jogo" value={formatPlayTime(summary.playTimeSec)} />
              <Stat label="Modo" value={summary.gameModeLabel} />
              <div className="col-span-full grid gap-3 sm:grid-cols-3">
                <CurrencyStat
                  label="Units"
                  value={summary.units.toLocaleString("pt-BR")}
                  onEdit={() => setEditingCurrency("units")}
                />
                <CurrencyStat
                  label="Nanites"
                  value={summary.nanites.toLocaleString("pt-BR")}
                  onEdit={() => setEditingCurrency("nanites")}
                />
                <CurrencyStat
                  label="Quicksilver"
                  value={summary.specials.toLocaleString("pt-BR")}
                  onEdit={() => setEditingCurrency("specials")}
                />
              </div>
              <Stat
                label="Naves"
                value={`${summary.shipCount} / ${summary.shipSlots}`}
              />
              <Stat label="Plataforma" value={summary.platform || "—"} />
              <Stat label="Versão" value={String(summary.gameVersion)} />
            </CardContent>
          </Card>

          {unknownKeys.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Chaves desconhecidas</CardTitle>
                <CardDescription>
                  O mapping não cobriu {unknownKeys.length} chave(s). O parser
                  as manteve como estão.
                </CardDescription>
              </CardHeader>
              <CardContent className="font-mono text-xs">
                {unknownKeys.join(", ")}
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                try {
                  const items = exportAllShips();
                  if (items.length === 0) {
                    toast.error("Nenhuma nave preenchida.");
                    return;
                  }
                  downloadNmsItemZip("ships.nmsitem.zip", items);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Falha no export",
                  );
                }
              }}
            >
              <FileJson />
              Exportar todas
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => importRef.current?.click()}
            >
              Importar .nmsitem
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".nmsitem,.json,application/json"
              className="hidden"
              onChange={(e) => {
                void onImportFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <Download />
                Baixar save
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    void (async () => {
                      try {
                        const bytes = await downloadRewritten();
                        const name = (fileName ?? "save.hg").replace(
                          /(\.hg)?$/i,
                          "-edited.hg",
                        );
                        downloadBytes(name, bytes);
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Falha ao recomprimir",
                        );
                      }
                    })();
                  }}
                >
                  Recomprimido (LZ4)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    try {
                      downloadBytes(
                        fileName ?? "save.hg",
                        downloadOriginal(),
                      );
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Sem original",
                      );
                    }
                  }}
                >
                  Original (backup)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                void clear();
                toast.message("Sessão do save encerrada.");
              }}
            >
              <Trash2 />
              Fechar save
            </Button>
          </div>
        </>
      ) : null}

      <CurrencyEditDialog
        field={editingCurrency}
        onClose={() => setEditingCurrency(null)}
      />

      <Dialog
        open={pendingItem != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingItem(null);
            setVersionWarning(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Versões diferentes</DialogTitle>
            <DialogDescription>
              {versionWarning} O import não é bloqueado, mas o jogo pode
              ignorar campos novos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingItem(null);
                setVersionWarning(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pendingItem) void commitImport(pendingItem);
              }}
            >
              Importar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
