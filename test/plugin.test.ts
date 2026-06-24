import { describe, expect, it } from "vitest";
import { eucJp } from "../src/euc-jp";
import {
  convert,
  decode,
  encode,
  getCodec,
  listCodecs,
  registerCodec,
} from "../src/index";
import { iso2022Jp } from "../src/iso-2022-jp";

const text = "日本語とASCIIの混在テキスト";

describe("built-in registry", () => {
  it("registers the three default codecs", () => {
    expect(listCodecs()).toEqual(
      expect.arrayContaining(["utf-8", "utf-8-bom", "shift_jis"]),
    );
  });

  it("returns a registered codec by name", () => {
    expect(getCodec("shift_jis")?.name).toBe("shift_jis");
    expect(getCodec("does-not-exist")).toBeUndefined();
  });

  it("throws a directed error for an unregistered name", () => {
    expect(() => encode(text, "euc-jp")).toThrow(/Unknown encoding "euc-jp"/);
  });
});

describe("passing a codec object directly", () => {
  it("encodes and decodes without registering", () => {
    const bytes = encode(text, eucJp);
    expect(decode(bytes, eucJp)).toBe(text);
  });

  it("converts between an extra codec and a built-in", () => {
    const eucBytes = encode(text, eucJp);
    const utf8Bytes = convert(eucBytes, eucJp, "utf-8");
    expect(new TextDecoder("utf-8").decode(utf8Bytes)).toBe(text);
  });

  it("converts between two extra codecs", () => {
    const eucBytes = encode(text, eucJp);
    const isoBytes = convert(eucBytes, eucJp, iso2022Jp);
    expect(decode(isoBytes, iso2022Jp)).toBe(text);
  });
});

describe("registering an extra codec", () => {
  it("lets it be referenced by name afterwards", () => {
    registerCodec(iso2022Jp);
    const bytes = encode(text, "iso-2022-jp");
    expect(decode(bytes, "iso-2022-jp")).toBe(text);
    expect(convert(bytes, "iso-2022-jp", "utf-8")).toEqual(
      new TextEncoder().encode(text),
    );
  });
});
