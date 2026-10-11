import { formatGalaxy } from "./galaxies";
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

export type SaveContext = "main" | "expedition";

const CONTEXT_FIELD = {
  main: "BaseContext",
  expedition: "ExpeditionContext",
} as const satisfies Record<SaveContext, string>;

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

export function contextRecord(
  json: unknown,
  context: SaveContext = "main",
): Record<string, unknown> | null {
  const root = asRecord(json);
  if (!root) return null;
  return asRecord(root[CONTEXT_FIELD[context]]);
}

export function getPlayerState(
  json: unknown,
  context: SaveContext = "main",
): Record<string, unknown> | null {
  const root = asRecord(json);
  if (!root) return null;
  const player = asRecord(contextRecord(json, context)?.PlayerStateData);
  if (player) return player;
  if (context === "main") return asRecord(root.PlayerStateData);
  return null;
}

export function hasExpeditionContext(json: unknown): boolean {
  return getPlayerState(json, "expedition") != null;
}

/** Contexto em que o jogo está. Qualquer ActiveContext diferente de Main, com expedição no arquivo, abre nela. */
export function initialSaveContext(json: unknown): SaveContext {
  if (!hasExpeditionContext(json)) return "main";
  const active = asString(asRecord(json)?.ActiveContext);
  if (active && active !== "Main") return "expedition";
  return "main";
}

export function missingPlayerMessage(context: SaveContext = "main"): string {
  return context === "expedition"
    ? "PlayerStateData ausente nesta expedição."
    : "PlayerStateData ausente neste save.";
}

export function summarizePlayer(
  json: unknown,
  context: SaveContext = "main",
): PlayerSummary {
  const root = asRecord(json) ?? {};
  const common = asRecord(root.CommonStateData) ?? {};
  const selected = contextRecord(json, context) ?? {};
  const player = getPlayerState(json, context) ?? {};
  const address = asRecord(player.UniverseAddress) ?? {};
  const ships = asArray(player.ShipOwnership) ?? [];
  const galaxy = asNumber(address.RealityIndex) ?? 0;
  const gameMode = asNumber(selected.GameMode) ?? 0;
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
    galaxyLabel: formatGalaxy(galaxy),
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
