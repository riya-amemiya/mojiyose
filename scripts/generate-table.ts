/**
 * Generates `src/shift-jis-table.ts` from the canonical WHATWG Encoding
 * Standard `index-jis0208.txt`.
 *
 * The generated module embeds the jis0208 index as a base64-encoded,
 * little-endian Uint16 array indexed by Shift_JIS pointer. A value of 0 marks
 * a pointer with no mapping (U+0000 never appears in the index, so it is a safe
 * sentinel). Both the decoder and the encoder are built from this single table
 * at module load, which keeps the result identical across environments instead
 * of relying on the host's ICU build.
 *
 * Run with: bun run scripts/generate-table.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, "index-jis0208.txt");
const outputPath = join(here, "..", "src", "shift-jis-table.ts");

const raw = readFileSync(sourcePath, "utf-8");

// Pull the source identifier and date out of the header comments so the
// generated file records exactly which revision of the index it came from.
const identifier = /^# Identifier:\s*(\S+)/m.exec(raw)?.[1] ?? "unknown";
const date = /^# Date:\s*(\S+)/m.exec(raw)?.[1] ?? "unknown";

const entries: Array<[pointer: number, codePoint: number]> = [];
let maxPointer = 0;
for (const line of raw.split("\n")) {
  if (line.length === 0 || line.startsWith("#")) {
    continue;
  }
  const fields = line.trim().split(/\s+/);
  if (fields.length < 2) {
    continue;
  }
  const pointer = Number.parseInt(fields[0], 10);
  const codePoint = Number.parseInt(fields[1], 16);
  if (!Number.isInteger(pointer) || !Number.isInteger(codePoint)) {
    throw new Error(`Malformed line: ${line}`);
  }
  if (codePoint <= 0 || codePoint > 0xffff) {
    throw new Error(
      `Code point out of the BMP range, cannot pack as Uint16: ${line}`,
    );
  }
  entries.push([pointer, codePoint]);
  if (pointer > maxPointer) {
    maxPointer = pointer;
  }
}

const length = maxPointer + 1;
const table = new Uint16Array(length);
for (const [pointer, codePoint] of entries) {
  if (table[pointer] !== 0) {
    throw new Error(`Duplicate pointer in source index: ${pointer}`);
  }
  table[pointer] = codePoint;
}

// Serialize as little-endian bytes so the runtime can rebuild the table
// deterministically regardless of the host's native endianness.
const bytes = new Uint8Array(length * 2);
for (let i = 0; i < length; i++) {
  bytes[i * 2] = table[i] & 0xff;
  bytes[i * 2 + 1] = table[i] >> 8;
}
const base64 = Buffer.from(bytes).toString("base64");

const output = `// AUTO-GENERATED FILE — do not edit by hand.
//
// jis0208 index from the WHATWG Encoding Standard.
//   https://encoding.spec.whatwg.org/index-jis0208.txt
//   Identifier: ${identifier}
//   Date: ${date}
//
// Regenerate with: bun run scripts/generate-table.ts
//
// The data is a base64-encoded little-endian Uint16 array indexed by Shift_JIS
// pointer (0 to ${maxPointer}). A value of 0 means the pointer has no mapping.

export const JIS0208_LENGTH = ${length};

export const JIS0208_BASE64 =
  "${base64}";
`;

writeFileSync(outputPath, output);

console.log(`Entries: ${entries.length}`);
console.log(`Max pointer: ${maxPointer}`);
console.log(`Table length: ${length}`);
console.log(`Base64 length: ${base64.length}`);
console.log(`Wrote ${outputPath}`);
