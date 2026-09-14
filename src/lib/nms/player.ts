import { asArray, asNumber, asRecord, asString } from "./value";

export const GAME_MODES: Record<number, string> = {
  0: "Unspecified",
  1: "Normal",
  2: "Creative",
  3: "Relaxed",
  4: "Survival",
  5: "Permadeath",
  6: "Seasonal",
};

export const GALAXIES: Record<number, string> = {
  0: "Euclid",
  1: "Hilbert Dimension",
  2: "Calypso",
  3: "Hesperius Dimension",
  4: "Hyades",
  5: "Ickjamatew",
};

export type PlayerSummary = {
  saveName: string;
  saveSummary: string;
  platform: string;
  gameVersion: number;
  gameMode: number;
  gameModeLabel: string;
  galaxy: number;
  galaxyLabel: string;
  playTimeSec: number;
  units: number;
  nanites: number;
  specials: number;
  shipCount: number;
  shipSlots: number;
};

export function getPlayerState(json: unknown): Record<string, unknown> | null {
  const root = asRecord(json);
  if (!root) return null;
  const base = asRecord(root.BaseContext);
  return asRecord(base?.PlayerStateData) ?? asRecord(root.PlayerStateData);
}

export function summarizePlayer(json: unknown): PlayerSummary {
  const root = asRecord(json) ?? {};
  const common = asRecord(root.CommonStateData) ?? {};
  const base = asRecord(root.BaseContext) ?? {};
  const player = getPlayerState(json) ?? {};
  const address = asRecord(player.UniverseAddress) ?? {};
  const ships = asArray(player.ShipOwnership) ?? [];
  const galaxy = asNumber(address.RealityIndex) ?? 0;
  const gameMode = asNumber(base.GameMode) ?? 0;
  const filledShips = ships.filter((slot) => {
    const rec = asRecord(slot);
    const resource = asRecord(rec?.Resource);
    const filename = asString(resource?.Filename);
    return Boolean(filename);
  }).length;

  return {
    saveName: asString(common.SaveName) ?? "",
    saveSummary: asString(player.SaveSummary) ?? "",
    platform: asString(root.Platform) ?? "",
    gameVersion: asNumber(root.Version) ?? 0,
    gameMode,
    gameModeLabel: GAME_MODES[gameMode] ?? `modo ${gameMode}`,
    galaxy,
    galaxyLabel: GALAXIES[galaxy] ?? `galáxia ${galaxy}`,
    playTimeSec: asNumber(common.TotalPlayTime) ?? asNumber(player.TimeAlive) ?? 0,
    units: asNumber(player.Units) ?? 0,
    nanites: asNumber(player.Nanites) ?? 0,
    specials: asNumber(player.Specials) ?? 0,
    shipCount: filledShips,
    shipSlots: ships.length,
  };
}

export function formatPlayTime(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 10) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours)} h`;
}
