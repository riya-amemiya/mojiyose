import {
  type Codec,
  type EncodeOptions,
  getCodec,
  listCodecs,
  type OnUnmappable,
  registerCodec,
  resolveCodec,
} from "./codec";
import {
  type ShiftJisEncodeOptions,
  shiftJis,
  shiftJisDecode,
  shiftJisEncode,
} from "./shift-jis";
import { addUtf8Bom, hasUtf8Bom, removeUtf8Bom, utf8, utf8Bom } from "./utf8";

export type { Codec, EncodeOptions, OnUnmappable, ShiftJisEncodeOptions };
export {
  addUtf8Bom,
  getCodec,
  hasUtf8Bom,
  listCodecs,
  registerCodec,
  removeUtf8Bom,
  shiftJis,
  shiftJisDecode,
  shiftJisEncode,
  utf8,
  utf8Bom,
};

// The codecs the base bundle ships with. Extra encodings live in their own
// modules (e.g. `mojiyose/euc-jp`); import and registerCodec() them, or pass
// the codec object directly, to keep the default bundle small.
registerCodec(utf8);
registerCodec(utf8Bom);
registerCodec(shiftJis);

/**
 * The encodings registered by default.
 *
 * - `"shift_jis"`: Shift_JIS (JIS X 0208).
 * - `"utf-8"`: UTF-8 without a byte order mark.
 * - `"utf-8-bom"`: UTF-8 prefixed with the EF BB BF byte order mark.
 */
export type Encoding = "shift_jis" | "utf-8" | "utf-8-bom";

/**
 * An encoding argument: a registered name (with `Encoding` autocompleted), any
 * other registered name, or a {@link Codec} passed directly.
 */
export type EncodingInput = Encoding | (string & {}) | Codec;

/** Retained for backward compatibility; identical to {@link EncodeOptions}. */
export interface ConvertOptions extends EncodeOptions {}

function isUtf8Family(codec: Codec): boolean {
  return codec.name === "utf-8" || codec.name === "utf-8-bom";
}

/** Decodes bytes in the given encoding into a string. */
export function decode(input: Uint8Array, from: EncodingInput): string {
  return resolveCodec(from).decode(input);
}

/** Encodes a string into bytes in the given encoding. */
export function encode(
  text: string,
  to: EncodingInput,
  options: ConvertOptions = {},
): Uint8Array {
  return resolveCodec(to).encode(text, options);
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
  from: EncodingInput,
  to: EncodingInput,
  options: ConvertOptions = {},
): Uint8Array {
  const fromCodec = resolveCodec(from);
  const toCodec = resolveCodec(to);
  if (isUtf8Family(fromCodec) && isUtf8Family(toCodec)) {
    const body = removeUtf8Bom(input);
    return toCodec.name === "utf-8-bom" ? addUtf8Bom(body) : body;
  }
  return toCodec.encode(fromCodec.decode(input), options);
}

/**
 * Best-effort detection of the encoding of `input`, limited to the three
 * encodings registered by default.
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
