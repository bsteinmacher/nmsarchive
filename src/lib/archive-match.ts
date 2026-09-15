import type { ExtractedShip } from "@/lib/nms/extract/types";

export function matchingShips(
  ships: ExtractedShip[],
  seed: string,
  category: string,
): ExtractedShip[] {
  const normalized = seed.toLowerCase();
  return ships.filter(
    (ship) =>
      !ship.empty &&
      ship.category === category &&
      ship.seed.toLowerCase() === normalized,
  );
}
