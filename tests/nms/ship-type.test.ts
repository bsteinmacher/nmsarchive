import { describe, expect, it } from "vitest";
import { shipTypeFromFilename } from "@/lib/nms/ship-type";

describe("shipTypeFromFilename", () => {
  it("mapeia marcadores do PLAN §2.7.3", () => {
    expect(
      shipTypeFromFilename(
        "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTERSPECIALSWITCH.SCENE.MBIN",
      ),
    ).toBe("Fighter");
    expect(
      shipTypeFromFilename(
        "MODELS/COMMON/SPACECRAFT/FIGHTERS/FIGHTER_PROC.SCENE.MBIN",
      ),
    ).toBe("Fighter");
    expect(
      shipTypeFromFilename(
        "MODELS/COMMON/SPACECRAFT/DROPSHIPS/DROPSHIP_PROC.SCENE.MBIN",
      ),
    ).toBe("Hauler");
    expect(
      shipTypeFromFilename(
        "MODELS/COMMON/SPACECRAFT/SHUTTLE/SHUTTLE_PROC.SCENE.MBIN",
      ),
    ).toBe("Shuttle");
    expect(
      shipTypeFromFilename(
        "MODELS/COMMON/SPACECRAFT/SCIENTIFIC/SCIENTIFIC_PROC.SCENE.MBIN",
      ),
    ).toBe("Explorer");
    expect(
      shipTypeFromFilename(
        "MODELS/COMMON/SPACECRAFT/S-CLASS/BIOPARTS/BIOSHIP_PROC.SCENE.MBIN",
      ),
    ).toBe("Living Ship");
    expect(
      shipTypeFromFilename(
        "MODELS/COMMON/SPACECRAFT/SENTINELSHIP/SENTINELSHIP_PROC.SCENE.MBIN",
      ),
    ).toBe("Interceptor");
    expect(
      shipTypeFromFilename("MODELS/COMMON/SPACECRAFT/FIGHTERS/WRACER.SCENE.MBIN"),
    ).toBe("Solar");
    expect(
      shipTypeFromFilename(
        "MODELS/COMMON/SPACECRAFT/SAILSHIP/SAILSHIP_PROC.SCENE.MBIN",
      ),
    ).toBe("Solar");
    expect(
      shipTypeFromFilename("MODELS/COMMON/SPACECRAFT/FIGHTERS/GOLDENVECTOR.SCENE.MBIN"),
    ).toBe("Exotic");
    expect(
      shipTypeFromFilename("MODELS/COMMON/SPACECRAFT/S-CLASS/BIGGS.SCENE.MBIN"),
    ).toBe("Exotic");
    expect(
      shipTypeFromFilename("MODELS/COMMON/SPACECRAFT/CORVETTE/CORVETTE.SCENE.MBIN"),
    ).toBe("Corvette");
  });

  it("sem match devolve o basename, nunca o path MODELS/COMMON", () => {
    const type = shipTypeFromFilename(
      "MODELS/COMMON/SPACECRAFT/WEIRD/UNKNOWN_PROC.SCENE.MBIN",
    );
    expect(type).toBe("UNKNOWN_PROC");
    expect(type.includes("MODELS")).toBe(false);
  });

  it("filename vazio fica vazio", () => {
    expect(shipTypeFromFilename("")).toBe("");
  });
});
