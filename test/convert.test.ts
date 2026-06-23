import { describe, expect, it } from "vitest";
import {
  addUtf8Bom,
  convert,
  decode,
  detect,
  encode,
  hasUtf8Bom,
  removeUtf8Bom,
} from "../src/index";

const text = "日本語とASCIIの混在テキスト";
const utf8 = new TextEncoder().encode(text);
const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]);
const sjis = encode(text, "shift_jis");

describe("encode and decode", () => {
  it("round-trips through utf-8", () => {
    expect(decode(encode(text, "utf-8"), "utf-8")).toBe(text);
  });

  it("round-trips through shift_jis", () => {
    expect(decode(encode(text, "shift_jis"), "shift_jis")).toBe(text);
  });

  it("adds a BOM for utf-8-bom and not for utf-8", () => {
    expect(Array.from(encode(text, "utf-8"))).toEqual(Array.from(utf8));
    expect(Array.from(encode(text, "utf-8-bom"))).toEqual(Array.from(utf8Bom));
  });

  it("ignores a BOM when decoding either utf-8 form", () => {
    expect(decode(utf8Bom, "utf-8")).toBe(text);
    expect(decode(utf8Bom, "utf-8-bom")).toBe(text);
  });
});

describe("convert", () => {
  it("shift_jis to utf-8", () => {
    expect(Array.from(convert(sjis, "shift_jis", "utf-8"))).toEqual(
      Array.from(utf8),
    );
  });

  it("shift_jis to utf-8-bom", () => {
    expect(Array.from(convert(sjis, "shift_jis", "utf-8-bom"))).toEqual(
      Array.from(utf8Bom),
    );
  });

  it("utf-8 to shift_jis", () => {
    expect(Array.from(convert(utf8, "utf-8", "shift_jis"))).toEqual(
      Array.from(sjis),
    );
  });

  it("utf-8-bom to shift_jis", () => {
    expect(Array.from(convert(utf8Bom, "utf-8-bom", "shift_jis"))).toEqual(
      Array.from(sjis),
    );
  });

  it("utf-8 to utf-8-bom adds the BOM", () => {
    expect(Array.from(convert(utf8, "utf-8", "utf-8-bom"))).toEqual(
      Array.from(utf8Bom),
    );
  });

  it("utf-8-bom to utf-8 removes the BOM", () => {
    expect(Array.from(convert(utf8Bom, "utf-8-bom", "utf-8"))).toEqual(
      Array.from(utf8),
    );
  });

  it("preserves invalid UTF-8 bytes between the two utf-8 forms", () => {
    const raw = Uint8Array.of(0x41, 0xff, 0xfe, 0x80, 0x42);
    const withBom = convert(raw, "utf-8", "utf-8-bom");
    expect(Array.from(withBom)).toEqual([0xef, 0xbb, 0xbf, ...raw]);
    expect(Array.from(convert(withBom, "utf-8-bom", "utf-8"))).toEqual(
      Array.from(raw),
    );
  });
});

describe("BOM helpers", () => {
  it("detects the BOM", () => {
    expect(hasUtf8Bom(utf8Bom)).toBe(true);
    expect(hasUtf8Bom(utf8)).toBe(false);
  });

  it("adds the BOM only when absent", () => {
    expect(Array.from(addUtf8Bom(utf8))).toEqual(Array.from(utf8Bom));
    expect(Array.from(addUtf8Bom(utf8Bom))).toEqual(Array.from(utf8Bom));
  });

  it("removes the BOM when present", () => {
    expect(Array.from(removeUtf8Bom(utf8Bom))).toEqual(Array.from(utf8));
    expect(Array.from(removeUtf8Bom(utf8))).toEqual(Array.from(utf8));
  });
});

describe("detect", () => {
  it("reports utf-8-bom for BOM-prefixed bytes", () => {
    expect(detect(utf8Bom)).toBe("utf-8-bom");
  });

  it("reports utf-8 for valid UTF-8 without a BOM", () => {
    expect(detect(utf8)).toBe("utf-8");
  });

  it("reports utf-8 for pure ASCII", () => {
    expect(detect(new TextEncoder().encode("plain ascii"))).toBe("utf-8");
  });

  it("reports shift_jis for byte streams that are not valid UTF-8", () => {
    expect(detect(sjis)).toBe("shift_jis");
  });
});
