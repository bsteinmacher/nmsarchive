"use client";

import { useSyncExternalStore } from "react";

export type SessionActivityKind = "open" | "save" | "cancel" | "change";

export type SessionActivityEvent = {
  id: string;
  kind: SessionActivityKind;
  fileName: string | null;
  saveName: string | null;
  label: string | null;
  at: Date;
};

const MAX_EVENTS = 40;
const RAIL_STORAGE_KEY = "nmsarchive:activity-rail";

let events: SessionActivityEvent[] = [];
const eventListeners = new Set<() => void>();
const openListeners = new Set<() => void>();

function emitEvents() {
  eventListeners.forEach((listener) => listener());
}

function emitOpen() {
  openListeners.forEach((listener) => listener());
}

function readStoredOpen(): boolean | null {
  try {
    const raw = localStorage.getItem(RAIL_STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore quota / private mode */
  }
  return null;
}

export function setActivityRailOpen(open: boolean) {
  try {
    localStorage.setItem(RAIL_STORAGE_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
  emitOpen();
}

export function openActivityRail() {
  setActivityRailOpen(true);
}

export function subscribeActivityRailOpen(listener: () => void) {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export function getActivityRailOpen() {
  return readStoredOpen() ?? false;
}

export function useActivityRailOpen() {
  return useSyncExternalStore(
    subscribeActivityRailOpen,
    getActivityRailOpen,
    () => false,
  );
}

export function pushSessionActivity(
  kind: SessionActivityKind,
  info?: {
    fileName?: string | null;
    saveName?: string | null;
    label?: string | null;
  },
) {
  events = [
    ...events,
    {
      id: crypto.randomUUID(),
      kind,
      fileName: info?.fileName?.trim() || null,
      saveName: info?.saveName?.trim() || null,
      label: info?.label?.trim() || null,
      at: new Date(),
    },
  ].slice(-MAX_EVENTS);
  emitEvents();
  if (kind === "save" || kind === "cancel") openActivityRail();
}

export function subscribeSessionActivity(listener: () => void) {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

export function getSessionActivity() {
  return events;
}

export function sessionActivityLabel(event: SessionActivityEvent): string {
  if (event.kind === "change") return event.label || "Alterou o save";
  const name = event.saveName || event.fileName || "";
  if (event.kind === "open") return name ? `Abriu save ${name}` : "Abriu save";
  if (event.kind === "save") return name ? `Salvou ${name}` : "Salvou";
  return name ? `Cancelou ${name}` : "Cancelou";
}

const EMPTY_EVENTS: SessionActivityEvent[] = [];

export function useSessionActivity() {
  return useSyncExternalStore(
    subscribeSessionActivity,
    getSessionActivity,
    () => EMPTY_EVENTS,
  );
}
