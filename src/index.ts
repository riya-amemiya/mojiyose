import {
  type OnUnmappable,
  type ShiftJisEncodeOptions,
  shiftJisDecode,
  shiftJisEncode,
} from "./shift-jis";

export type { OnUnmappable, ShiftJisEncodeOptions };
export { shiftJisDecode, shiftJisEncode };

/**
 * Supported encodings.
 *
 * - `"shift_jis"`: Shift_JIS (JIS X 0208).
 * - `"utf-8"`: UTF-8 without a byte order mark.
 * - `"utf-8-bom"`: UTF-8 prefixed with the EF BB BF byte order mark.
 */
export type Encoding = "shift_jis" | "utf-8" | "utf-8-bom";

export interface ConvertOptions {
  /**
   * What to do when a character cannot be represented in the target encoding.
   * Only meaningful when the target is `"shift_jis"`. Defaults to `"replace"`.
   */
  onUnmappable?: OnUnmappable;
}

const UTF8_BOM_BYTES = [0xef, 0xbb, 0xbf] as const;

let utf8Decoder: TextDecoder | undefined;
let utf8Encoder: TextEncoder | undefined;

function utf8Decode(input: Uint8Array): string {
  utf8Decoder ??= new TextDecoder("utf-8");
  return utf8Decoder.decode(input);
}

function utf8Encode(text: string): Uint8Array {
  utf8Encoder ??= new TextEncoder();
  return utf8Encoder.encode(text);
}

/** Returns true if `input` starts with the UTF-8 byte order mark. */
export function hasUtf8Bom(input: Uint8Array): boolean {
  return (
    input.length >= 3 &&
    input[0] === UTF8_BOM_BYTES[0] &&
    input[1] === UTF8_BOM_BYTES[1] &&
    input[2] === UTF8_BOM_BYTES[2]
  );
}

/** Returns `input` without a leading UTF-8 BOM (a view; the input is unchanged). */
export function removeUtf8Bom(input: Uint8Array): Uint8Array {
  return hasUtf8Bom(input) ? input.subarray(3) : input;
}

/** Returns `input` with a leading UTF-8 BOM, adding one only if absent. */
export function addUtf8Bom(input: Uint8Array): Uint8Array {
  if (hasUtf8Bom(input)) {
    return input;
  }
  const out = new Uint8Array(input.length + 3);
  out[0] = UTF8_BOM_BYTES[0];
  out[1] = UTF8_BOM_BYTES[1];
  out[2] = UTF8_BOM_BYTES[2];
  out.set(input, 3);
  return out;
}

/** Decodes bytes in the given encoding into a string. */
export function decode(input: Uint8Array, from: Encoding): string {
  if (from === "shift_jis") {
    return shiftJisDecode(input);
  }
  return utf8Decode(input);
}

/** Encodes a string into bytes in the given encoding. */
export function encode(
  text: string,
  to: Encoding,
  options: ConvertOptions = {},
): Uint8Array {
  switch (to) {
    case "shift_jis":
      return shiftJisEncode(text, options as ShiftJisEncodeOptions);
    case "utf-8":
      return utf8Encode(text);
    case "utf-8-bom":
      return addUtf8Bom(utf8Encode(text));
  }
}

/**
 * Converts a byte sequence from one encoding to another.
 *
 * Conversions between the two UTF-8 forms only add or remove the BOM and leave
 * the remaining bytes untouched, so they are lossless even for input that is
 * not valid UTF-8.
 */
export function convert(
  input: Uint8Array,
  from: Encoding,
  to: Encoding,
  options: ConvertOptions = {},
): Uint8Array {
  const fromUtf8 = from === "utf-8" || from === "utf-8-bom";
  const toUtf8 = to === "utf-8" || to === "utf-8-bom";
  if (fromUtf8 && toUtf8) {
    const body = removeUtf8Bom(input);
    return to === "utf-8-bom" ? addUtf8Bom(body) : body;
  }
  return encode(decode(input, from), to, options);
}

/**
 * Best-effort detection of the encoding of `input`, limited to the three
 * encodings this library handles.
 *
 * A leading BOM is reported as `"utf-8-bom"`. Otherwise the bytes are checked
 * for valid UTF-8 and reported as `"utf-8"` when they pass. Any remaining byte
 * sequence is assumed to be `"shift_jis"`. Pure ASCII is valid UTF-8 and is
 * reported as `"utf-8"`.
 */
export function detect(input: Uint8Array): Encoding {
  if (hasUtf8Bom(input)) {
    return "utf-8-bom";
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(input);
    return "utf-8";
  } catch {
    return "shift_jis";
  }
}
