// The two UTF-8 forms. These lean on the platform TextEncoder/TextDecoder and
// carry no index table, so they cost almost nothing in the bundle.
import type { Codec } from "./codec";

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

/** UTF-8 without a byte order mark. A leading BOM is ignored when decoding. */
export const utf8: Codec = {
  name: "utf-8",
  encode(text) {
    return utf8Encode(text);
  },
  decode(input) {
    return utf8Decode(input);
  },
};

/** UTF-8 prefixed with the EF BB BF byte order mark. */
export const utf8Bom: Codec = {
  name: "utf-8-bom",
  encode(text) {
    return addUtf8Bom(utf8Encode(text));
  },
  decode(input) {
    return utf8Decode(input);
  },
};
