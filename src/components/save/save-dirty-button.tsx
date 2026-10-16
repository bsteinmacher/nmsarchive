"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fsErrorMessage } from "@/lib/nms/fs-access";
import { useSaveLocation } from "@/stores/save-location";
import { useSaveSession } from "@/stores/save-session";
import { reportSaveInPlace } from "./save-in-place";

export function SaveDirtyButton() {
  const dirty = useSaveSession((s) => s.dirty);
  const status = useSaveSession((s) => s.status);
  const writing = useSaveLocation((s) => s.writing);
  const saveInPlace = useSaveLocation((s) => s.saveInPlace);
  const [confirmStale, setConfirmStale] = useState(false);
  const visible = status === "ready" && dirty;

  useEffect(() => {
    if (!visible) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [visible]);

  async function onSave(force = false) {
    try {
      const result = await saveInPlace(force);
      await reportSaveInPlace(result, () => setConfirmStale(true));
    } catch (err) {
      toast.error(fsErrorMessage(err));
    }
  }

  if (!visible) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="ml-auto"
        disabled={writing}
        onClick={() => void onSave(false)}
      >
        <Save />
        {writing ? "Salvando…" : "Salvar neste arquivo"}
      </Button>
      <Dialog open={confirmStale} onOpenChange={setConfirmStale}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivo mudou no disco</DialogTitle>
            <DialogDescription>
              O save no disco é mais novo do que o que está aberto. Salvar por
              cima usa um backup da versão do disco.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStale(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setConfirmStale(false);
                void onSave(true);
              }}
            >
              Salvar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
