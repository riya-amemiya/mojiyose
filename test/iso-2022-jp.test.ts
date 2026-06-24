import { describe, expect, it } from "vitest";
import {
  iso2022Jp,
  iso2022JpDecode,
  iso2022JpEncode,
} from "../src/iso-2022-jp";

const samples = [
  "こんにちは、世界！",
  "亜唖娃阿哀愛挨",
  "日本語のテスト文字列",
  "ひらがな　カタカナ　漢字",
  "Mixed ASCII と日本語 123",
  "改行\nを含む\tテキスト",
];

describe("iso-2022-jp round trip", () => {
  for (const sample of samples) {
    it(`re-decodes ${sample} to the original`, () => {
      expect(iso2022JpDecode(iso2022JpEncode(sample))).toBe(sample);
    });
  }
});

describe("agreement with the platform ISO-2022-JP decoder", () => {
  for (const sample of samples) {
    it(`decodes ${sample} like TextDecoder`, () => {
      const bytes = iso2022JpEncode(sample);
      const reference = new TextDecoder("iso-2022-jp").decode(bytes);
      expect(iso2022JpDecode(bytes)).toBe(reference);
    });
  }
});

describe("known byte sequences", () => {
  it("wraps あ in the jis0208 escape and returns to ASCII", () => {
    expect(Array.from(iso2022JpEncode("あ"))).toEqual([
      0x1b, 0x24, 0x42, 0x24, 0x22, 0x1b, 0x28, 0x42,
    ]);
  });

  it("only switches state around the kanji in mixed text", () => {
    expect(Array.from(iso2022JpEncode("Aあ"))).toEqual([
      0x41, 0x1b, 0x24, 0x42, 0x24, 0x22, 0x1b, 0x28, 0x42,
    ]);
  });

  it("uses the Roman escape for U+00A5", () => {
    expect(Array.from(iso2022JpEncode("¥"))).toEqual([
      0x1b, 0x28, 0x4a, 0x5c, 0x1b, 0x28, 0x42,
    ]);
  });

  it("leaves pure ASCII untouched", () => {
    expect(Array.from(iso2022JpEncode("Hello"))).toEqual([
      0x48, 0x65, 0x6c, 0x6c, 0x6f,
    ]);
  });

  it("decodes an explicit escape sequence", () => {
    const bytes = Uint8Array.of(0x1b, 0x24, 0x42, 0x24, 0x22, 0x1b, 0x28, 0x42);
    expect(iso2022JpDecode(bytes)).toBe("あ");
  });
});

describe("characters the encoder cannot represent", () => {
  it("replaces half-width katakana with ? by default", () => {
    expect(Array.from(iso2022JpEncode("ｱ"))).toEqual([0x3f]);
  });

  it('throws when onUnmappable is "throw"', () => {
    expect(() =>
      iso2022JpEncode("\u{1f600}", { onUnmappable: "throw" }),
    ).toThrow(/Cannot encode/);
  });

  it("returns to ASCII before emitting the replacement", () => {
    // A kanji puts the encoder in the jis0208 state; the unmappable emoji must
    // first reset to ASCII so the "?" decodes unambiguously.
    const bytes = iso2022JpEncode("漢\u{1f600}");
    expect(iso2022JpDecode(bytes)).toBe("漢?");
    expect(new TextDecoder("iso-2022-jp").decode(bytes)).toBe("漢?");
  });
});

describe("codec object", () => {
  it("exposes the same functions under the iso-2022-jp name", () => {
    expect(iso2022Jp.name).toBe("iso-2022-jp");
    expect(iso2022Jp.decode(iso2022Jp.encode("漢字"))).toBe("漢字");
  });
});
