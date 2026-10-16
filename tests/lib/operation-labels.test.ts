import { describe, expect, it } from "vitest";
import { formatOperationLabel, logSubject } from "@/lib/operation-labels";
import { sessionActivityLabel } from "@/stores/session-activity";

describe("operation-labels", () => {
  it("traduz ações conhecidas e deixa o resto como está", () => {
    expect(formatOperationLabel("archive")).toBe("Arquivou");
    expect(formatOperationLabel("custom_op")).toBe("custom_op");
  });

  it("tira o assunto do item, do arquivo ou do rótulo", () => {
    expect(logSubject({ item: { name: "Golden Vector" }, detail: null })).toBe(
      "Golden Vector",
    );
    expect(
      logSubject({ detail: { fileName: "save2.hg" } }),
    ).toBe("save2.hg");
    expect(logSubject({ detail: { label: "Units" } })).toBe("Units");
    expect(logSubject({ detail: {} })).toBeNull();
  });
});

describe("sessionActivityLabel", () => {
  function event(
    kind: "open" | "save" | "cancel" | "change",
    names: {
      fileName?: string | null;
      saveName?: string | null;
      label?: string | null;
    } = {},
  ) {
    return {
      id: "1",
      kind,
      fileName: names.fileName ?? null,
      saveName: names.saveName ?? null,
      label: names.label ?? null,
      at: new Date("2026-10-16T12:00:00Z"),
    };
  }

  it("usa o nome do save e o arquivo como fallback", () => {
    expect(sessionActivityLabel(event("open", { saveName: "Main" }))).toBe(
      "Abriu save Main",
    );
    expect(sessionActivityLabel(event("save", { fileName: "save2.hg" }))).toBe(
      "Salvou save2.hg",
    );
    expect(sessionActivityLabel(event("cancel"))).toBe("Cancelou");
    expect(
      sessionActivityLabel(event("change", { label: "Aplicou Golden Vector" })),
    ).toBe("Aplicou Golden Vector");
  });
});
