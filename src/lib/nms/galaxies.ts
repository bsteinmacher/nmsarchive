/**
 * RealityIndex 0–255 no JSON; a UI mostra 1–256.
 * Lista parcial até a Fase 5. Nomes conhecidos; o resto é "Galáxia {n}".
 */
export const GALAXY_NAMES: Record<number, string> = {
  0: "Euclid",
  1: "Hilbert Dimension",
  2: "Calypso",
  3: "Hesperius Dimension",
  4: "Hyades",
  5: "Ickjamatew",
  6: "Budullangr",
  7: "Kikolgallr",
  8: "Eltiensleen",
  9: "Eissentam",
  255: "Odyalutai",
};

export function formatGalaxy(index: number): string {
  const display = index + 1;
  const name = GALAXY_NAMES[index];
  return name ? `${display} · ${name}` : `Galáxia ${display}`;
}

/** Converte o número que o jogador vê (1–256) para RealityIndex (0–255). */
export function parseGalaxyDisplay(display: number): number {
  if (!Number.isInteger(display) || display < 1 || display > 256) {
    throw new Error("Galáxia na UI deve ser 1–256.");
  }
  return display - 1;
}
