import { describe, expect, it } from "vitest";
import { checkHealth } from "@/lib/health";

describe("checkHealth", () => {
  it("retorna 200 quando o ping do banco passa", async () => {
    const result = await checkHealth(async () => 1);
    expect(result).toEqual({
      status: 200,
      body: { ok: true, service: "nmsarchive" },
    });
  });

  it("retorna 503 quando o ping falha", async () => {
    const result = await checkHealth(async () => {
      throw new Error("database unavailable");
    });
    expect(result.status).toBe(503);
    expect(result.body.ok).toBe(false);
    expect(result.body.error).toBe("database unavailable");
  });
});
