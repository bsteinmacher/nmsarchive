import { describe, expect, it } from "vitest";
import {
  assertStoredWebp,
  detectScreenshotKind,
  screenshotFileName,
  screenshotPublicUrl,
} from "@/lib/screenshots";

/** 1×1 WebP mínimo (VP8). */
export const MINI_WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20, 0x18, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d,
  0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x34, 0x25, 0xa4, 0x00,
  0x03, 0x70, 0x00, 0xfe, 0xfb, 0x94, 0x00, 0x00,
]);

describe("screenshots", () => {
  it("reconhece WebP e rejeita SVG", () => {
    expect(detectScreenshotKind(MINI_WEBP)).toBe("webp");
    expect(
      detectScreenshotKind(new TextEncoder().encode("<svg xmlns='n'></svg>")),
    ).toBe("svg");
    expect(() => assertStoredWebp(MINI_WEBP)).not.toThrow();
    expect(() =>
      assertStoredWebp(new TextEncoder().encode("<svg></svg>")),
    ).toThrow(/SVG|WebP/);
  });

  it("só aceita basename UUID.webp", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(screenshotFileName(id)).toBe(`${id}.webp`);
    expect(screenshotPublicUrl(`${id}.webp`)).toBe(`/api/screenshots/${id}`);
    expect(() => screenshotFileName("../secret.webp")).toThrow();
    expect(() => screenshotFileName("/tmp/x.webp")).toThrow();
  });
});
