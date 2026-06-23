import { describe, expect, it } from "vitest";
import { shiftJisDecode, shiftJisEncode } from "../src/index";

const samples = [
  "こんにちは、世界！",
  "ＡＢＣ１２３ｱｲｳ",
  "半角カナと全角カナ",
  "亜唖娃阿哀愛挨",
  "日本語のテスト文字列",
  "ひらがな　カタカナ　漢字",
];

describe("shift_jis round trip", () => {
  for (const sample of samples) {
    it(`re-decodes ${sample} to the original`, () => {
      const bytes = shiftJisEncode(sample);
      expect(shiftJisDecode(bytes)).toBe(sample);
    });
  }
});

describe("agreement with the platform Shift_JIS decoder", () => {
  for (const sample of samples) {
    it(`decodes ${sample} like TextDecoder`, () => {
      const bytes = shiftJisEncode(sample);
      const reference = new TextDecoder("shift_jis").decode(bytes);
      expect(shiftJisDecode(bytes)).toBe(reference);
    });
  }
});

describe("known byte sequences", () => {
  it("encodes あ as 0x82 0xA0", () => {
    expect(Array.from(shiftJisEncode("あ"))).toEqual([0x82, 0xa0]);
  });

  it("encodes 亜 as 0x88 0x9F", () => {
    expect(Array.from(shiftJisEncode("亜"))).toEqual([0x88, 0x9f]);
  });

  it("encodes half-width katakana ｱ as the single byte 0xB1", () => {
    expect(Array.from(shiftJisEncode("ｱ"))).toEqual([0xb1]);
  });

  it("maps U+00A5 to 0x5C and U+203E to 0x7E", () => {
    expect(Array.from(shiftJisEncode("¥‾"))).toEqual([0x5c, 0x7e]);
  });

  it("leaves ASCII untouched", () => {
    expect(Array.from(shiftJisEncode("Hello"))).toEqual([
      0x48, 0x65, 0x6c, 0x6c, 0x6f,
    ]);
  });
});

describe("unmappable characters", () => {
  it("replaces them with ? by default", () => {
    expect(Array.from(shiftJisEncode("A\u{1f600}B"))).toEqual([
      0x41, 0x3f, 0x42,
    ]);
  });

  it('throws when onUnmappable is "throw"', () => {
    expect(() =>
      shiftJisEncode("\u{1f600}", { onUnmappable: "throw" }),
    ).toThrow(/Cannot encode/);
  });
});

describe("malformed Shift_JIS input", () => {
  it("replaces a dangling lead byte with U+FFFD", () => {
    expect(shiftJisDecode(Uint8Array.of(0x82))).toBe("�");
  });

  it("replaces an invalid trail byte with U+FFFD", () => {
    // 0x82 is a valid lead byte; 0x20 (space) is not a valid trail byte, so it
    // is reprocessed as ASCII after the replacement character.
    expect(shiftJisDecode(Uint8Array.of(0x82, 0x20))).toBe("� ");
  });
});
