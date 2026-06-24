// ISO-2022-JP codec implemented to the WHATWG Encoding Standard.
// https://encoding.spec.whatwg.org/#iso-2022-jp-decoder
//
// ISO-2022-JP is stateful: escape sequences switch between ASCII, the JIS X
// 0201 Roman set, half-width katakana (decode only) and the jis0208 plane. It
// reuses the shared jis0208 index, so it adds no table of its own.
import type { Codec, EncodeOptions } from "./codec";
import { codeUnitsToString, REPLACEMENT } from "./decode-util";
import { jis0208DecodeIndex, jis0208EncodeMap } from "./jis0208";

const EOF = -1;

// Decoder states.
const ASCII = 0;
const ROMAN = 1;
const KATAKANA = 2;
const LEAD = 3;
const TRAIL = 4;
const ESCAPE_START = 5;
const ESCAPE = 6;

/**
 * Decodes an ISO-2022-JP byte sequence into a string. Invalid sequences and
 * unmapped pointers become U+FFFD, matching the WHATWG decoder.
 */
export function iso2022JpDecode(input: Uint8Array): string {
  const jis0208 = jis0208DecodeIndex();
  const units: number[] = [];
  // `prepend` holds bytes pushed back for reprocessing, read before `input`.
  const prepend: number[] = [];
  let i = 0;
  const next = (): number => {
    if (prepend.length > 0) {
      return prepend.shift() as number;
    }
    return i < input.length ? input[i++] : EOF;
  };

  let state = ASCII;
  let outputState = ASCII;
  let lead = 0;
  let outputFlag = false;

  for (;;) {
    const byte = next();
    switch (state) {
      case ASCII:
        if (byte === 0x1b) {
          state = ESCAPE_START;
        } else if (
          byte >= 0x00 &&
          byte <= 0x7f &&
          byte !== 0x0e &&
          byte !== 0x0f
        ) {
          outputFlag = false;
          units.push(byte);
        } else if (byte === EOF) {
          return codeUnitsToString(units);
        } else {
          outputFlag = false;
          units.push(REPLACEMENT);
        }
        break;
      case ROMAN:
        if (byte === 0x1b) {
          state = ESCAPE_START;
        } else if (byte === 0x5c) {
          outputFlag = false;
          units.push(0x00a5);
        } else if (byte === 0x7e) {
          outputFlag = false;
          units.push(0x203e);
        } else if (
          byte >= 0x00 &&
          byte <= 0x7f &&
          byte !== 0x0e &&
          byte !== 0x0f
        ) {
          outputFlag = false;
          units.push(byte);
        } else if (byte === EOF) {
          return codeUnitsToString(units);
        } else {
          outputFlag = false;
          units.push(REPLACEMENT);
        }
        break;
      case KATAKANA:
        if (byte === 0x1b) {
          state = ESCAPE_START;
        } else if (byte >= 0x21 && byte <= 0x5f) {
          outputFlag = false;
          units.push(0xff61 - 0x21 + byte);
        } else if (byte === EOF) {
          return codeUnitsToString(units);
        } else {
          outputFlag = false;
          units.push(REPLACEMENT);
        }
        break;
      case LEAD:
        if (byte === 0x1b) {
          state = ESCAPE_START;
        } else if (byte >= 0x21 && byte <= 0x7e) {
          outputFlag = false;
          lead = byte;
          state = TRAIL;
        } else if (byte === EOF) {
          return codeUnitsToString(units);
        } else {
          outputFlag = false;
          units.push(REPLACEMENT);
        }
        break;
      case TRAIL:
        if (byte === 0x1b) {
          state = ESCAPE_START;
          units.push(REPLACEMENT);
        } else if (byte >= 0x21 && byte <= 0x7e) {
          state = LEAD;
          const pointer = (lead - 0x21) * 94 + byte - 0x21;
          const codePoint = pointer < jis0208.length ? jis0208[pointer] : 0;
          units.push(codePoint === 0 ? REPLACEMENT : codePoint);
        } else if (byte === EOF) {
          // Re-read EOF in the lead-byte state, which finishes.
          state = LEAD;
          units.push(REPLACEMENT);
        } else {
          state = LEAD;
          units.push(REPLACEMENT);
        }
        break;
      case ESCAPE_START:
        if (byte === 0x24 || byte === 0x28) {
          lead = byte;
          state = ESCAPE;
        } else {
          if (byte !== EOF) {
            prepend.unshift(byte);
          }
          outputFlag = false;
          state = outputState;
          units.push(REPLACEMENT);
        }
        break;
      case ESCAPE: {
        const escapeLead = lead;
        lead = 0;
        let nextState = -1;
        if (escapeLead === 0x28 && byte === 0x42) {
          nextState = ASCII;
        } else if (escapeLead === 0x28 && byte === 0x4a) {
          nextState = ROMAN;
        } else if (escapeLead === 0x28 && byte === 0x49) {
          nextState = KATAKANA;
        } else if (escapeLead === 0x24 && (byte === 0x40 || byte === 0x42)) {
          nextState = LEAD;
        }
        if (nextState !== -1) {
          state = nextState;
          outputState = nextState;
          const seenOutput = outputFlag;
          outputFlag = true;
          if (seenOutput) {
            units.push(REPLACEMENT);
          }
        } else {
          // Reprocess the escape body (escapeLead, then byte) in the output state.
          prepend.unshift(
            ...(byte === EOF ? [escapeLead] : [escapeLead, byte]),
          );
          outputFlag = false;
          state = outputState;
          units.push(REPLACEMENT);
        }
        break;
      }
    }
  }
}

// Encoder states.
const ENC_ASCII = 0;
const ENC_ROMAN = 1;
const ENC_JIS0208 = 2;

/**
 * Encodes a string into ISO-2022-JP bytes following the WHATWG encoder. The
 * encoder cannot represent half-width katakana (it has no katakana state), so
 * those characters are treated as unmappable. On `"replace"` the encoder first
 * returns to the ASCII state, then emits "?" (0x3F), so the output stays valid.
 */
export function iso2022JpEncode(
  text: string,
  options: EncodeOptions = {},
): Uint8Array {
  const encodeIndex = jis0208EncodeMap();
  const onUnmappable = options.onUnmappable ?? "replace";
  const out: number[] = [];
  const codePoints: number[] = [];
  for (const character of text) {
    codePoints.push(character.codePointAt(0) as number);
  }
  let qi = 0;
  const prepend: number[] = [];
  const next = (): number => {
    if (prepend.length > 0) {
      return prepend.shift() as number;
    }
    return qi < codePoints.length ? codePoints[qi++] : EOF;
  };

  let state = ENC_ASCII;
  const fail = (codePoint: number): void => {
    if (onUnmappable === "throw") {
      const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
      throw new Error(`Cannot encode U+${hex} in ISO-2022-JP`);
    }
    if (state !== ENC_ASCII) {
      out.push(0x1b, 0x28, 0x42);
      state = ENC_ASCII;
    }
    out.push(0x3f); // "?"
  };

  for (;;) {
    let codePoint = next();
    if (codePoint === EOF) {
      if (state !== ENC_ASCII) {
        out.push(0x1b, 0x28, 0x42);
        state = ENC_ASCII;
      }
      return Uint8Array.from(out);
    }
    if (
      (state === ENC_ASCII || state === ENC_ROMAN) &&
      (codePoint === 0x0e || codePoint === 0x0f || codePoint === 0x1b)
    ) {
      fail(codePoint);
      continue;
    }
    if (state === ENC_ASCII && codePoint <= 0x7f) {
      out.push(codePoint);
      continue;
    }
    if (
      state === ENC_ROMAN &&
      ((codePoint <= 0x7f && codePoint !== 0x5c && codePoint !== 0x7e) ||
        codePoint === 0x00a5 ||
        codePoint === 0x203e)
    ) {
      if (codePoint <= 0x7f) {
        out.push(codePoint);
      } else if (codePoint === 0x00a5) {
        out.push(0x5c);
      } else {
        out.push(0x7e); // U+203E
      }
      continue;
    }
    if (codePoint <= 0x7f && state !== ENC_ASCII) {
      prepend.unshift(codePoint);
      state = ENC_ASCII;
      out.push(0x1b, 0x28, 0x42);
      continue;
    }
    if ((codePoint === 0x00a5 || codePoint === 0x203e) && state !== ENC_ROMAN) {
      prepend.unshift(codePoint);
      state = ENC_ROMAN;
      out.push(0x1b, 0x28, 0x4a);
      continue;
    }
    if (codePoint === 0x2212) {
      codePoint = 0xff0d;
    }
    const pointer = encodeIndex.get(codePoint);
    if (pointer === undefined) {
      fail(codePoint);
      continue;
    }
    if (state !== ENC_JIS0208) {
      prepend.unshift(codePoint);
      state = ENC_JIS0208;
      out.push(0x1b, 0x24, 0x42);
      continue;
    }
    out.push(Math.floor(pointer / 94) + 0x21, (pointer % 94) + 0x21);
  }
}

/** ISO-2022-JP (JIS X 0208) per the WHATWG Encoding Standard. */
export const iso2022Jp: Codec = {
  name: "iso-2022-jp",
  encode: iso2022JpEncode,
  decode: iso2022JpDecode,
};
