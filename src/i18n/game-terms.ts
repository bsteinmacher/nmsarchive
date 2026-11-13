/** Nomes do cliente em pt-BR. A chave gravada continua em inglês. */
const GAME_TERMS: Record<string, string> = {
  Fighter: "Caça",
  Hauler: "Transportadora",
  Explorer: "Exploradora",
  Shuttle: "Ônibus espacial",
  Exotic: "Exótica",
  Solar: "Solar",
  "Living Ship": "Nave viva",
  Interceptor: "Interceptadora",
  Corvette: "Corveta",
  Pistol: "Pistola",
  Rifle: "Rifle",
  Experimental: "Experimental",
  Alien: "Alienígena",
  "Exotic / Royal": "Exótica / Real",
  Sentinel: "Sentinela",
  Atlantid: "Atlântida",
  "Voltaic Staff": "Cajado voltaico",
};

export function gameTermLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return label;
  return GAME_TERMS[trimmed] ?? label;
}
