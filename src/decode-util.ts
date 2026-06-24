// Small helpers shared by the index-table codecs (Shift_JIS, EUC-JP,
// ISO-2022-JP) that decode into BMP code units.

/** U+FFFD, emitted in place of bytes that have no mapping. */
export const REPLACEMENT = 0xfffd;

/** Joins UTF-16 code units, chunked to stay under the fromCharCode arg limit. */
export function codeUnitsToString(units: number[]): string {
  const CHUNK = 0x8000;
  let result = "";
  for (let i = 0; i < units.length; i += CHUNK) {
    result += String.fromCharCode.apply(null, units.slice(i, i + CHUNK));
  }
  return result;
}
