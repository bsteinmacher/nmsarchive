import { describe, expect, it } from "vitest";
import {
  bytesToLatin1,
  bytesToUtf8Lossy,
  collectHighByteStrings,
  countHighBytes,
  latin1ToBytes,
  parseJsonLatin1,
  stringifyJsonLatin1,
  stripTrailingNul,
} from "@/lib/nms/json";

describe("json Latin-1", () => {
  it("remove um NUL trailing", () => {
    const withNul = new Uint8Array([0x7b, 0x7d, 0x00]);
    expect(stripTrailingNul(withNul)).toEqual(new Uint8Array([0x7b, 0x7d]));
  });

  it("round-trip preserva bytes 0x80+ dentro de strings JSON", () => {
    const raw = '{"Id":"AA\x80BB"}';
    const bytes = latin1ToBytes(raw);
    expect(countHighBytes(bytes)).toBe(1);
    expect(() =>
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ).toThrow();
    const parsed = parseJsonLatin1(bytes) as { Id: string };
    expect(parsed.Id.charCodeAt(2)).toBe(0x80);
    expect(collectHighByteStrings(parsed)).toEqual(["AA\x80BB"]);
    const again = stringifyJsonLatin1(parsed);
    expect(countHighBytes(again)).toBe(1);
    expect((parseJsonLatin1(again) as { Id: string }).Id).toBe(parsed.Id);
  });

  it("UTF-8 lossy é só para display", () => {
    const bytes = latin1ToBytes('{"x":"\x80"}');
    expect(bytesToUtf8Lossy(bytes)).toContain("�");
    expect(bytesToLatin1(bytes)).toBe('{"x":"\x80"}');
  });
});
