import { describe, expect, it } from "vitest";
import { formatOperationLabel, logSubject } from "@/lib/operation-labels";
import { sessionActivityLabel } from "@/stores/session-activity";
import settings from "../../messages/pt-BR/settings.json";

const operations = settings.operations as Record<string, string>;
const activity = settings.activity;

function activityText(
  key: keyof typeof activity,
  values?: { name: string },
) {
  const template = activity[key];
  return values ? template.replaceAll("{name}", values.name) : template;
}

describe("operation-labels", () => {
  it("traduz ações conhecidas e deixa o resto como está", () => {
    expect(formatOperationLabel("archive", (key) => operations[key])).toBe(
      "Arquivou",
    );
    expect(formatOperationLabel("custom_op", (key) => operations[key])).toBe(
      "custom_op",
    );
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
    expect(sessionActivityLabel(event("open", { saveName: "Main" }), activityText)).toBe(
      "Abriu save Main",
    );
    expect(sessionActivityLabel(event("save", { fileName: "save2.hg" }), activityText)).toBe(
      "Salvou save2.hg",
    );
    expect(sessionActivityLabel(event("cancel"), activityText)).toBe("Cancelou");
    expect(
      sessionActivityLabel(event("change", { label: "Aplicou Golden Vector" }), activityText),
    ).toBe("Aplicou Golden Vector");
  });
});
