import { describe, expect, it } from "vitest";
import { companionSpeciesTag } from "@/lib/nms/extract/names";

describe("companionSpeciesTag", () => {
  it("usa o CreatureID inteiro quando não é UI_", () => {
    expect(companionSpeciesTag("^HOVER_PET")).toBe("HOVER_PET");
    expect(companionSpeciesTag("TREX")).toBe("TREX");
    expect(companionSpeciesTag("^BONECAT")).toBe("BONECAT");
    expect(companionSpeciesTag("BLOB")).toBe("BLOB");
  });

  it("extrai o token do meio em IDs de expedition UI_", () => {
    expect(companionSpeciesTag("^UI_FIEND_NAME")).toBe("FIEND");
    expect(companionSpeciesTag("UI_HOVERPET_SPECIES")).toBe("HOVERPET");
    expect(companionSpeciesTag("UI_PETQUAD_SPECIES")).toBe("PETQUAD");
    expect(companionSpeciesTag("UI_BONECAT_SPECIES")).toBe("BONECAT");
  });

  it("não devolve a string UI_ completa", () => {
    expect(companionSpeciesTag("UI_FIEND_NAME").startsWith("UI_")).toBe(false);
  });
});
