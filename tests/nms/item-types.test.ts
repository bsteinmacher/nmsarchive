import { describe, expect, it } from "vitest";
import {
  archiveMultitoolType,
  MULTITOOL_TYPES,
  multitoolTypeFromFilename,
  normalizeMultitoolType,
} from "@/lib/nms/multitool-type";
import { freighterTypeFromFilename, frigateClassLabel } from "@/lib/nms/freighter-type";

describe("multitoolTypeFromFilename", () => {
  it("mapeia staff, royal e atlas para os tipos da wiki", () => {
    expect(
      multitoolTypeFromFilename(
        "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOLATLAS.SCENE.MBIN",
      ),
    ).toBe("Voltaic Staff");
    expect(
      multitoolTypeFromFilename(
        "MODELS/COMMON/WEAPONS/MULTITOOL/ATLASMULTITOOL.SCENE.MBIN",
      ),
    ).toBe("Atlas");
    expect(
      multitoolTypeFromFilename(
        "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOL.SCENE.MBIN",
      ),
    ).toBe("Voltaic Staff");
    expect(
      multitoolTypeFromFilename(
        "MODELS/COMMON/WEAPONS/MULTITOOL/ROYALMULTITOOL.SCENE.MBIN",
      ),
    ).toBe("Exotic / Royal");
    expect(
      multitoolTypeFromFilename(
        "MODELS/COMMON/WEAPONS/MULTITOOL/MULTITOOL.SCENE.MBIN",
      ),
    ).toBe("Multi-tool");
  });

  it("normaliza aliases e deixa Multi-tool para o usuário escolher", () => {
    expect(MULTITOOL_TYPES).toEqual([
      "Pistol",
      "Rifle",
      "Experimental",
      "Alien",
      "Exotic / Royal",
      "Sentinel",
      "Atlantid",
      "Voltaic Staff",
    ]);
    expect(normalizeMultitoolType("Staff")).toBe("Voltaic Staff");
    expect(normalizeMultitoolType("Atlas Staff")).toBe("Voltaic Staff");
    expect(normalizeMultitoolType("Royal")).toBe("Exotic / Royal");
    expect(normalizeMultitoolType("Multi-tool")).toBe("");
    expect(archiveMultitoolType("Multi-tool")).toBe("");
    expect(archiveMultitoolType("Fishing")).toBe("Fishing");
    expect(archiveMultitoolType("Pistol")).toBe("Pistol");
  });
});

describe("freighter types", () => {
  it("reconhece pirate freighter e classes de fragata", () => {
    expect(
      freighterTypeFromFilename(
        "MODELS/COMMON/SPACECRAFT/INDUSTRIAL/PIRATEFREIGHTER.SCENE.MBIN",
      ),
    ).toBe("Pirate");
    expect(frigateClassLabel("DeepSpace")).toBe("Leviathan");
    expect(frigateClassLabel("DeepSpaceCommon")).toBe("Organic");
  });
});
