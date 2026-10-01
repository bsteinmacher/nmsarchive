"use client";

import { useEffect } from "react";
import { useSaveLocation } from "@/stores/save-location";
import { useSaveSession } from "@/stores/save-session";

export function SaveSessionHydrator() {
  const hydrate = useSaveSession((s) => s.hydrate);
  const hydrateLocation = useSaveLocation((s) => s.hydrateLocation);
  useEffect(() => {
    void (async () => {
      await hydrate();
      await hydrateLocation();
    })();
  }, [hydrate, hydrateLocation]);
  return null;
}
