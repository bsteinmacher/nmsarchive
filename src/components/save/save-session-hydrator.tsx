"use client";

import { useEffect } from "react";
import { useSaveSession } from "@/stores/save-session";

export function SaveSessionHydrator() {
  const hydrate = useSaveSession((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return null;
}
