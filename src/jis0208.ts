// The jis0208 index from the WHATWG Encoding Standard, shared by every codec
// that maps through it: Shift_JIS, EUC-JP and ISO-2022-JP. Each direction is
// built lazily from the single embedded table so importing a codec that never
// encodes (or never decodes) does not pay for the other direction.
import { unpackUint16Table } from "./base64";
import { JIS0208_BASE64, JIS0208_LENGTH } from "./jis0208-table";

// The "index Shift_JIS pointer" excludes pointers 8272 to 8835 so that the code
// points duplicated in that range round-trip to a single canonical pointer.
// EUC-JP and ISO-2022-JP use the plain index pointer and keep the whole range.
const SHIFT_JIS_SKIP_START = 8272;
const SHIFT_JIS_SKIP_END = 8835;

let decodeIndex: Uint16Array | undefined;

/** Pointer to code point; entries left at 0 mark a pointer with no mapping. */
export function jis0208DecodeIndex(): Uint16Array {
  decodeIndex ??= unpackUint16Table(JIS0208_BASE64, JIS0208_LENGTH);
  return decodeIndex;
}

function buildEncodeMap(
  skipStart: number,
  skipEnd: number,
): Map<number, number> {
  const table = jis0208DecodeIndex();
  const map = new Map<number, number>();
  for (let pointer = 0; pointer < table.length; pointer++) {
    if (pointer >= skipStart && pointer <= skipEnd) {
      continue;
    }
    const codePoint = table[pointer];
    if (codePoint === 0) {
      continue;
    }
    // The first pointer wins, matching "the index pointer for code point".
    if (!map.has(codePoint)) {
      map.set(codePoint, pointer);
    }
  }
  return map;
}

let encodeMap: Map<number, number> | undefined;
let shiftJisEncodeMap: Map<number, number> | undefined;

/** Code point to pointer over the whole index (EUC-JP, ISO-2022-JP). */
export function jis0208EncodeMap(): Map<number, number> {
  encodeMap ??= buildEncodeMap(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  );
  return encodeMap;
}

/** Code point to pointer excluding 8272..8835 (Shift_JIS canonical pointers). */
export function jis0208ShiftJisEncodeMap(): Map<number, number> {
  shiftJisEncodeMap ??= buildEncodeMap(
    SHIFT_JIS_SKIP_START,
    SHIFT_JIS_SKIP_END,
  );
  return shiftJisEncodeMap;
}
