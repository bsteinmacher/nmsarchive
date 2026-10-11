import { describe, expect, it } from "vitest";
import {
  parseArchiveSearch,
  serializeArchiveSearch,
} from "@/lib/archive-url";
import {
  archiveViewCookieAssignment,
  parseArchiveViewCookie,
} from "@/lib/archive-view";

describe("archive-url", () => {
  it("serializa classe S, tag exotic e galáxia 1–256", () => {
    const params = serializeArchiveSearch({
      className: "S",
      tags: ["exotic"],
      galaxyDisplay: 256,
      view: "table",
    });
    expect(params.get("class")).toBe("S");
    expect(params.get("tags")).toBe("exotic");
    expect(params.get("galaxy")).toBe("256");
    expect(params.get("view")).toBe("table");

    const parsed = parseArchiveSearch(params);
    expect(parsed.className).toBe("S");
    expect(parsed.tags).toEqual(["exotic"]);
    expect(parsed.galaxyDisplay).toBe(256);
    expect(parsed.view).toBe("table");
  });

  it("guarda tabela ou grade no cookie e ignora o resto", () => {
    expect(parseArchiveViewCookie("table")).toBe("table");
    expect(parseArchiveViewCookie("grid")).toBe("grid");
    expect(parseArchiveViewCookie("lista")).toBeUndefined();
    expect(parseArchiveViewCookie(undefined)).toBeUndefined();
    expect(archiveViewCookieAssignment("table")).toContain(
      "nmsarchive-view=table",
    );
  });
});
