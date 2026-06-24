// EUC-JP codec implemented to the WHATWG Encoding Standard.
// https://encoding.spec.whatwg.org/#euc-jp-decoder
//
// EUC-JP shares the jis0208 index with Shift_JIS, so the two-byte plane costs
// nothing extra here. The only table this module adds is jis0212, used by the
// three-byte (0x8F) decode path; the encoder never emits jis0212, matching the
// spec, so encoding needs jis0208 alone.
import { unpackUint16Table } from "./base64";
import type { Codec, EncodeOptions } from "./codec";
import { codeUnitsToString, REPLACEMENT } from "./decode-util";
import { jis0208DecodeIndex, jis0208EncodeMap } from "./jis0208";
import { JIS0212_BASE64, JIS0212_LENGTH } from "./jis0212-table";

let jis0212Index: Uint16Array | undefined;
function jis0212DecodeIndex(): Uint16Array {
  jis0212Index ??= unpackUint16Table(JIS0212_BASE64, JIS0212_LENGTH);
  return jis0212Index;
}

/**
 * Decodes an EUC-JP byte sequence into a string. Unmapped bytes become U+FFFD,
 * matching the WHATWG decoder's replacement mode.
 */
export function eucJpDecode(input: Uint8Array): string {
  const jis0208 = jis0208DecodeIndex();
  const units: number[] = [];
  let lead = 0;
  let jis0212 = false;
  for (let i = 0; i < input.length; i++) {
    const byte = input[i];
    if (lead === 0x8e && byte >= 0xa1 && byte <= 0xdf) {
      lead = 0;
      units.push(0xff61 - 0xa1 + byte);
      continue;
    }
    if (lead === 0x8f && byte >= 0xa1 && byte <= 0xfe) {
      jis0212 = true;
      lead = byte;
      continue;
    }
    if (lead !== 0) {
      const currentLead = lead;
      lead = 0;
      let codePoint = 0;
      if (
        currentLead >= 0xa1 &&
        currentLead <= 0xfe &&
        byte >= 0xa1 &&
        byte <= 0xfe
      ) {
        const pointer = (currentLead - 0xa1) * 94 + (byte - 0xa1);
        const table = jis0212 ? jis0212DecodeIndex() : jis0208;
        codePoint = pointer < table.length ? table[pointer] : 0;
      }
      jis0212 = false;
      if (byte <= 0x7f) {
        // An ASCII trail byte is reprocessed as a standalone byte.
        i--;
      }
      units.push(codePoint === 0 ? REPLACEMENT : codePoint);
      continue;
    }
    if (byte <= 0x7f) {
      units.push(byte);
    } else if (
      byte === 0x8e ||
      byte === 0x8f ||
      (byte >= 0xa1 && byte <= 0xfe)
    ) {
      lead = byte;
    } else {
      units.push(REPLACEMENT);
    }
  }
  if (lead !== 0) {
    units.push(REPLACEMENT);
  }
  return codeUnitsToString(units);
}

/**
 * Encodes a string into EUC-JP bytes following the WHATWG encoder, including
 * its special cases for U+00A5, U+203E, U+2212 and half-width katakana.
 */
export function eucJpEncode(
  text: string,
  options: EncodeOptions = {},
): Uint8Array {
  const encodeIndex = jis0208EncodeMap();
  const onUnmappable = options.onUnmappable ?? "replace";
  const out: number[] = [];
  for (const character of text) {
    let codePoint = character.codePointAt(0) as number;
    if (codePoint <= 0x7f) {
      out.push(codePoint);
      continue;
    }
    if (codePoint === 0x00a5) {
      out.push(0x5c);
      continue;
    }
    if (codePoint === 0x203e) {
      out.push(0x7e);
      continue;
    }
    if (codePoint >= 0xff61 && codePoint <= 0xff9f) {
      out.push(0x8e, codePoint - 0xff61 + 0xa1);
      continue;
    }
    if (codePoint === 0x2212) {
      codePoint = 0xff0d;
    }
    const pointer = encodeIndex.get(codePoint);
    if (pointer === undefined) {
      if (onUnmappable === "throw") {
        const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
        throw new Error(`Cannot encode U+${hex} in EUC-JP`);
      }
      out.push(0x3f); // "?"
      continue;
    }
    out.push(Math.floor(pointer / 94) + 0xa1, (pointer % 94) + 0xa1);
  }
  return Uint8Array.from(out);
}

/** EUC-JP (JIS X 0208 and JIS X 0212) per the WHATWG Encoding Standard. */
export const eucJp: Codec = {
  name: "euc-jp",
  encode: eucJpEncode,
  decode: eucJpDecode,
};
