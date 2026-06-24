// Generates the embedded index tables under `src/` from the canonical WHATWG
// index files. Run with: bun run scripts/generate-table.ts
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "src");

interface IndexSpec {
  // Base name of the WHATWG index file (without the `index-` prefix or suffix).
  source: string;
  // Output module file name under `src/`.
  output: string;
  // Constant name prefix used for the exported `<PREFIX>_LENGTH`/`_BASE64`.
  constant: string;
}

const indexes: IndexSpec[] = [
  { source: "jis0208", output: "jis0208-table.ts", constant: "JIS0208" },
  { source: "jis0212", output: "jis0212-table.ts", constant: "JIS0212" },
];

function buildTable(spec: IndexSpec): void {
  const sourcePath = join(here, `index-${spec.source}.txt`);
  const outputPath = join(srcDir, spec.output);
  const raw = readFileSync(sourcePath, "utf-8");

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

  // Little-endian bytes so the runtime rebuilds the table the same on any host.
  const bytes = new Uint8Array(length * 2);
  for (let i = 0; i < length; i++) {
    bytes[i * 2] = table[i] & 0xff;
    bytes[i * 2 + 1] = table[i] >> 8;
  }
  const base64 = Buffer.from(bytes).toString("base64");

  const output = `// AUTO-GENERATED FILE — do not edit by hand.
//
// ${spec.source} index from the WHATWG Encoding Standard.
//   https://encoding.spec.whatwg.org/index-${spec.source}.txt
//   Identifier: ${identifier}
//   Date: ${date}
//
// Regenerate with: bun run scripts/generate-table.ts

export const ${spec.constant}_LENGTH = ${length};

export const ${spec.constant}_BASE64 =
  "${base64}";
`;

  writeFileSync(outputPath, output);

  console.log(
    `[${spec.source}] entries=${entries.length} length=${length} base64=${base64.length} -> ${spec.output}`,
  );
}

for (const spec of indexes) {
  buildTable(spec);
}
