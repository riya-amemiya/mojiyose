import { describe, expect, it } from "vitest";
import { eucJp, eucJpDecode, eucJpEncode } from "../src/euc-jp";

const samples = [
  "こんにちは、世界！",
  "ＡＢＣ１２３ｱｲｳ",
  "半角カナと全角カナ",
  "亜唖娃阿哀愛挨",
  "日本語のテスト文字列",
  "ひらがな　カタカナ　漢字",
  "Mixed ASCII と日本語 123",
];

describe("euc-jp round trip", () => {
  for (const sample of samples) {
    it(`re-decodes ${sample} to the original`, () => {
      expect(eucJpDecode(eucJpEncode(sample))).toBe(sample);
    });
  }
});

describe("agreement with the platform EUC-JP decoder", () => {
  for (const sample of samples) {
    it(`decodes ${sample} like TextDecoder`, () => {
      const bytes = eucJpEncode(sample);
      const reference = new TextDecoder("euc-jp").decode(bytes);
      expect(eucJpDecode(bytes)).toBe(reference);
    });
  }
});

describe("known byte sequences", () => {
  it("encodes あ as 0xA4 0xA2", () => {
    expect(Array.from(eucJpEncode("あ"))).toEqual([0xa4, 0xa2]);
  });

  it("encodes 亜 as 0xB0 0xA1", () => {
    expect(Array.from(eucJpEncode("亜"))).toEqual([0xb0, 0xa1]);
  });

  it("encodes half-width katakana ｱ as 0x8E 0xB1", () => {
    expect(Array.from(eucJpEncode("ｱ"))).toEqual([0x8e, 0xb1]);
  });

  it("maps U+00A5 to 0x5C and U+203E to 0x7E", () => {
    expect(Array.from(eucJpEncode("¥‾"))).toEqual([0x5c, 0x7e]);
  });

  it("leaves ASCII untouched", () => {
    expect(Array.from(eucJpEncode("Hello"))).toEqual([
      0x48, 0x65, 0x6c, 0x6c, 0x6f,
    ]);
  });
});

describe("jis0212 three-byte decoding", () => {
  it("decodes 0x8F 0xA2 0xAF as U+02D8 like TextDecoder", () => {
    const bytes = Uint8Array.of(0x8f, 0xa2, 0xaf);
    expect(eucJpDecode(bytes)).toBe("˘");
    expect(eucJpDecode(bytes)).toBe(new TextDecoder("euc-jp").decode(bytes));
  });
});

describe("unmappable characters", () => {
  it("replaces them with ? by default", () => {
    expect(Array.from(eucJpEncode("A\u{1f600}B"))).toEqual([0x41, 0x3f, 0x42]);
  });

  it('throws when onUnmappable is "throw"', () => {
    expect(() => eucJpEncode("\u{1f600}", { onUnmappable: "throw" })).toThrow(
      /Cannot encode/,
    );
  });
});

describe("malformed input", () => {
  it("replaces a dangling lead byte with U+FFFD", () => {
    expect(eucJpDecode(Uint8Array.of(0xa1))).toBe("�");
  });

  it("reprocesses an ASCII trail byte after the replacement character", () => {
    expect(eucJpDecode(Uint8Array.of(0xa1, 0x20))).toBe("� ");
  });
});

describe("codec object", () => {
  it("exposes the same functions under the euc-jp name", () => {
    expect(eucJp.name).toBe("euc-jp");
    expect(eucJp.decode(eucJp.encode("漢字"))).toBe("漢字");
  });
});
