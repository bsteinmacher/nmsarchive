"use client";

import { useRef, useState } from "react";
import { Download, FileJson, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { trpc } from "@/lib/trpc";
import { formatPlayTime } from "@/lib/nms/player";
import { usesApplyDepth } from "@/lib/nms/extract/apply-depth";
import { gameVersionMismatch, parseNmsItem, type NmsItemFile } from "@/lib/nmsitem";
import { ApplyToSaveDialog } from "@/components/items/apply-to-save-dialog";
import { CollapsibleCard } from "@/components/layout/collapsible-card";
import { downloadNmsItemZip } from "@/lib/nmsitem-zip";
import { getMappedJson, useSaveSession } from "@/stores/save-session";
import { pushSessionActivity } from "@/stores/session-activity";
import { CurrencyEditDialog, type CurrencyField } from "./currencies-dialog";
import { SaveContextSwitch } from "./save-context-switch";
import { SaveLocationPanel } from "./save-location-panel";
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
  const expeditionAvailable = useSaveSession((s) => s.expeditionAvailable);
  const downloadRewritten = useSaveSession((s) => s.downloadRewritten);
  const downloadOriginal = useSaveSession((s) => s.downloadOriginal);
  const dirty = useSaveSession((s) => s.dirty);
  const reparseOpenSave = useSaveSession((s) => s.reparseOpenSave);
  const utils = trpc.useUtils();
  const mappingAvailability = trpc.settings.mappingAvailability.useQuery(
    undefined,
    {
      enabled: unknownKeys.length > 0,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  );
  const updateMapping = trpc.settings.updateMapping.useMutation();
  const newerMapping = mappingAvailability.data?.updateAvailable === true;
  const importRef = useRef<HTMLInputElement>(null);
  const [pendingItem, setPendingItem] = useState<NmsItemFile | null>(null);
  const [versionWarning, setVersionWarning] = useState<string | null>(null);
  const [choiceFile, setChoiceFile] = useState<NmsItemFile | null>(null);
  const [editingCurrency, setEditingCurrency] = useState<CurrencyField | null>(
    null,
  );
  const [sourcePanel, setSourcePanel] = useState<null | "folder" | "loose">(
    null,
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function toggleSource(panel: "folder" | "loose") {
    setSourcePanel((current) => (current === panel ? null : panel));
  }

  async function closeSave() {
    setConfirmDiscard(false);
    if (dirty) {
      pushSessionActivity("cancel", {
        fileName,
        saveName: summary?.saveName,
      });
    }
    await clear();
    toast.message("Sessão do save encerrada.");
  }

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    void closeSave();
  }

  async function commitImport(item: NmsItemFile) {
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
    let item: NmsItemFile;
    try {
      item = parseNmsItem(await file.text());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Arquivo inválido");
      return;
    }
    if (usesApplyDepth(item.category)) {
      setChoiceFile(item);
      return;
    }
    const json = getMappedJson();
    const warning = json ? gameVersionMismatch(item, json) : null;
    if (warning) {
      setPendingItem(item);
      setVersionWarning(warning);
      return;
    }
    try {
      const index = await importItem(item);
      toast.success(`Item importado no slot ${index + 1}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no import");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Save aberto
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A pasta do jogo é deste computador. O JSON do save aberto fica no
          IndexedDB. O .hg só passa pelo app local para abrir e gravar de volta.
        </p>
      </div>

      {status === "ready" && summary ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{summary.saveName || fileName || "Save"}</CardTitle>
            <CardDescription>
              {summary.saveSummary || "Sem SaveSummary"} · mapping{" "}
              {mappingVersion}
            </CardDescription>
            {expeditionAvailable ? (
              <CardAction>
                <SaveContextSwitch />
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Galaxy" value={summary.galaxyLabel} />
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
              label="Ships"
              value={`${summary.shipCount} / ${summary.shipSlots}`}
            />
            <Stat label="Plataforma" value={summary.platform || "—"} />
            <Stat label="Versão" value={String(summary.gameVersion)} />
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                try {
                  const items = exportAllShips();
                  if (items.length === 0) {
                    toast.error("Nenhuma Ship preenchida.");
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
            <Button
              type="button"
              variant="ghost"
              className="sm:ml-auto"
              onClick={requestClose}
            >
              <Trash2 />
              Fechar save
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {status === "hydrating" || status === "loading"
                ? "Carregando o save…"
                : "Nenhum save aberto"}
            </CardTitle>
            <CardDescription>
              Abra a pasta do jogo ou solte um save.hg para ver galáxia, moedas
              e naves.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {unknownKeys.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Chaves desconhecidas</CardTitle>
            <CardDescription>
              {newerMapping
                ? `O MBINCompiler publicou o mapping ${mappingAvailability.data?.remoteVersion} (o cache está em ${mappingAvailability.data?.localVersion}). Atualize o mapping e abra o save de novo.`
                : `O mapping não cobriu ${unknownKeys.length} chave(s). O parser as manteve como estão.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-xs">
            {unknownKeys.join(", ")}
          </CardContent>
          {newerMapping ? (
            <CardFooter>
              <Button
                type="button"
                variant="outline"
                disabled={updateMapping.isPending}
                onClick={() => {
                  void (async () => {
                    try {
                      const result = await updateMapping.mutateAsync();
                      let reparsed = false;
                      try {
                        reparsed = await reparseOpenSave();
                      } catch {
                        reparsed = false;
                      }
                      toast.success(
                        reparsed
                          ? `mapping.json ${result.libMBIN_version}. O save foi lido de novo.`
                          : `mapping.json ${result.libMBIN_version}. Abra o save de novo para aplicar.`,
                      );
                      await Promise.all([
                        utils.settings.get.invalidate(),
                        utils.logs.list.invalidate(),
                        utils.settings.mappingAvailability.invalidate(),
                      ]);
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Falha ao atualizar mapping",
                      );
                    }
                  })();
                }}
              >
                {updateMapping.isPending ? "Baixando…" : "Atualizar mapping.json"}
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      ) : null}

      <SaveLocationPanel
        expanded={sourcePanel === "folder"}
        onToggle={() => toggleSource("folder")}
      />

      <CollapsibleCard
        title="Arquivo avulso"
        description={
          <>
            Sem a pasta, a gravação volta a ser download. O app não lê nem
            regenera <code>mf_save</code>.
          </>
        }
        expandLabel="Abrir arquivo avulso"
        collapseLabel="Recolher arquivo avulso"
        expanded={sourcePanel === "loose"}
        onExpandedChange={() => toggleSource("loose")}
        contentClassName="space-y-3"
      >
        <UploadDropzone />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {status === "ready" && summary ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <Download />
              Baixar cópia
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
                Arquivo editado
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    downloadBytes(fileName ?? "save.hg", downloadOriginal());
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Sem original",
                    );
                  }
                }}
              >
                Arquivo original
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </CollapsibleCard>

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterações não salvas</DialogTitle>
            <DialogDescription>
              As alterações feitas não foram salvas. Use Salvar neste arquivo
              ou Baixar arquivo editado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => void closeSave()}>
              Fechar mesmo assim
            </Button>
            <Button onClick={() => setConfirmDiscard(false)}>Voltar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplyToSaveDialog
        open={choiceFile != null}
        onOpenChange={(next) => {
          if (!next) setChoiceFile(null);
        }}
        sourceFile={choiceFile}
      />

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
