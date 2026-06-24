// Shift_JIS codec implemented to the WHATWG Encoding Standard, with both
// directions driven by the shared jis0208 index in `jis0208.ts`.
// https://encoding.spec.whatwg.org/#shift_jis-decoder
import type { Codec, EncodeOptions, OnUnmappable } from "./codec";
import { codeUnitsToString, REPLACEMENT } from "./decode-util";
import { jis0208DecodeIndex, jis0208ShiftJisEncodeMap } from "./jis0208";

export type { OnUnmappable };
/** Retained for backward compatibility; identical to {@link EncodeOptions}. */
export type ShiftJisEncodeOptions = EncodeOptions;

/**
 * Decodes a Shift_JIS byte sequence into a string. Bytes that cannot be mapped
 * are replaced with U+FFFD, matching the WHATWG decoder's replacement mode.
 */
export function shiftJisDecode(input: Uint8Array): string {
  const decodeIndex = jis0208DecodeIndex();
  // Every output is in the BMP, so each is a single UTF-16 code unit.
  const units: number[] = [];
  let lead = 0;
  for (let i = 0; i < input.length; i++) {
    const byte = input[i];
    if (lead !== 0) {
      const currentLead = lead;
      lead = 0;
      const offset = byte < 0x7f ? 0x40 : 0x41;
      const leadOffset = currentLead < 0xa0 ? 0x81 : 0xc1;
      let pointer = -1;
      if ((byte >= 0x40 && byte <= 0x7e) || (byte >= 0x80 && byte <= 0xfc)) {
        pointer = (currentLead - leadOffset) * 188 + byte - offset;
      }
      if (pointer >= 8836 && pointer <= 10715) {
        // End-user-defined characters map into the Private Use Area.
        units.push(0xe000 + pointer - 8836);
        continue;
      }
      const codePoint =
        pointer >= 0 && pointer < decodeIndex.length ? decodeIndex[pointer] : 0;
      if (codePoint !== 0) {
        units.push(codePoint);
        continue;
      }
      units.push(REPLACEMENT);
      if (byte <= 0x7f) {
        // An ASCII trail byte is reprocessed as a standalone byte.
        i--;
      }
      continue;
    }
    if (byte <= 0x80) {
      units.push(byte);
    } else if (byte >= 0xa1 && byte <= 0xdf) {
      units.push(0xff61 + byte - 0xa1);
    } else if (
      (byte >= 0x81 && byte <= 0x9f) ||
      (byte >= 0xe0 && byte <= 0xfc)
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
 * Encodes a string into Shift_JIS bytes following the WHATWG encoder, including
 * its special cases for U+00A5, U+203E, U+2212 and half-width katakana.
 */
export function shiftJisEncode(
  text: string,
  options: ShiftJisEncodeOptions = {},
): Uint8Array {
  const encodeIndex = jis0208ShiftJisEncodeMap();
  const onUnmappable = options.onUnmappable ?? "replace";
  const out: number[] = [];
  for (const character of text) {
    let codePoint = character.codePointAt(0) as number;
    if (codePoint <= 0x80) {
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
      out.push(codePoint - 0xff61 + 0xa1);
      continue;
    }
    if (codePoint === 0x2212) {
      codePoint = 0xff0d;
    }
    const pointer = encodeIndex.get(codePoint);
    if (pointer === undefined) {
      if (onUnmappable === "throw") {
        const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
        throw new Error(`Cannot encode U+${hex} in Shift_JIS`);
      }
      out.push(0x3f); // "?"
      continue;
    }
    const lead = Math.floor(pointer / 188);
    const leadOffset = lead < 0x1f ? 0x81 : 0xc1;
    const trail = pointer % 188;
    const offset = trail < 0x3f ? 0x40 : 0x41;
    out.push(lead + leadOffset, trail + offset);
  }
  return Uint8Array.from(out);
}

/** Shift_JIS (JIS X 0208) as defined by the WHATWG Encoding Standard. */
export const shiftJis: Codec = {
  name: "shift_jis",
  encode: shiftJisEncode,
  decode: shiftJisDecode,
};
