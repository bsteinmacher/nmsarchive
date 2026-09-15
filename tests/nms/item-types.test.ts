import { describe, expect, it } from "vitest";
import { multitoolTypeFromFilename } from "@/lib/nms/multitool-type";
import { freighterTypeFromFilename, frigateClassLabel } from "@/lib/nms/freighter-type";

describe("multitoolTypeFromFilename", () => {
  it("mapeia staff atlas antes de staff e atlas", () => {
    expect(
      multitoolTypeFromFilename(
        "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOLATLAS.SCENE.MBIN",
      ),
    ).toBe("Atlas Staff");
    expect(
      multitoolTypeFromFilename(
        "MODELS/COMMON/WEAPONS/MULTITOOL/ATLASMULTITOOL.SCENE.MBIN",
      ),
    ).toBe("Atlas");
    expect(
      multitoolTypeFromFilename(
        "MODELS/COMMON/WEAPONS/MULTITOOL/STAFFMULTITOOL.SCENE.MBIN",
      ),
    ).toBe("Staff");
    expect(
      multitoolTypeFromFilename(
        "MODELS/COMMON/WEAPONS/MULTITOOL/MULTITOOL.SCENE.MBIN",
      ),
    ).toBe("Multi-tool");
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
