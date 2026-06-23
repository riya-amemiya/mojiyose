# mojiyose

A tiny, dependency-free TypeScript library that converts byte sequences between
Shift_JIS, UTF-8, and UTF-8 without a byte order mark.

The UTF-8 side uses the platform `TextEncoder` / `TextDecoder`. The Shift_JIS
side is implemented from the WHATWG Encoding Standard's jis0208 index, with the
same table driving both encoding and decoding, so the mapping is identical in
every runtime rather than depending on the host's ICU build. There are no
runtime dependencies, and the published bundle ships only the index table it
needs.

## Install

```sh
npm install mojiyose
```

## Encodings

The library models three encodings as string literals:

**`"shift_jis"`**：Shift_JIS (JIS X 0208), the byte mapping defined by the
WHATWG Encoding Standard.

**`"utf-8"`**：UTF-8 without a byte order mark. This is the canonical meaning of
"UTF-8".

**`"utf-8-bom"`**：UTF-8 prefixed with the `EF BB BF` byte order mark.

## Usage

```ts
import { convert, decode, encode } from "mojiyose";

// Shift_JIS bytes -> UTF-8 bytes (no BOM)
const utf8 = convert(shiftJisBytes, "shift_jis", "utf-8");

// UTF-8 bytes -> Shift_JIS bytes
const sjis = convert(utf8Bytes, "utf-8", "shift_jis");

// Add or strip the BOM without touching the rest of the bytes
const withBom = convert(utf8Bytes, "utf-8", "utf-8-bom");
const withoutBom = convert(bomBytes, "utf-8-bom", "utf-8");

// Bytes <-> string directly
const text = decode(shiftJisBytes, "shift_jis");
const bytes = encode("日本語", "shift_jis");
```

`convert`, `decode`, and `encode` all operate on `Uint8Array`, so they work the
same in Node.js and the browser.

## API

### `convert(input, from, to, options?)`

Converts `input` (`Uint8Array`) from the `from` encoding to the `to` encoding
and returns a new `Uint8Array`. Conversions between the two UTF-8 forms only add
or remove the BOM and leave the remaining bytes untouched, so they are lossless
even when the input is not valid UTF-8.

### `decode(input, from)`

Decodes a `Uint8Array` in the `from` encoding into a string. A leading BOM is
ignored for both UTF-8 forms. Bytes with no Shift_JIS mapping become U+FFFD.

### `encode(text, to, options?)`

Encodes a string into a `Uint8Array` in the `to` encoding.

### `detect(input)`

Best-effort detection limited to these three encodings. A leading BOM is
reported as `"utf-8-bom"`; otherwise valid UTF-8 is reported as `"utf-8"`, and
any remaining byte sequence is assumed to be `"shift_jis"`. Pure ASCII is valid
UTF-8 and is reported as `"utf-8"`.

```ts
import { detect } from "mojiyose";

detect(bytes); // "shift_jis" | "utf-8" | "utf-8-bom"
```

### BOM helpers

`hasUtf8Bom(input)` returns whether `input` starts with the UTF-8 BOM.
`addUtf8Bom(input)` returns the bytes with a BOM, adding one only if absent.
`removeUtf8Bom(input)` returns the bytes without a leading BOM.

### Unmappable characters

Shift_JIS cannot represent every character. The `options.onUnmappable` setting
controls what `encode(text, "shift_jis")` and `convert(..., "shift_jis")` do
when they hit one:

```ts
encode("😀", "shift_jis"); // default "replace" -> a "?" (0x3F) byte
encode("😀", "shift_jis", { onUnmappable: "throw" }); // throws instead
```

### Lower-level Shift_JIS access

`shiftJisEncode(text, options?)` and `shiftJisDecode(input)` are exported for
callers that only need the Shift_JIS codec.

## How the table is built

`src/shift-jis-table.ts` is generated from the canonical WHATWG
`index-jis0208.txt` by `scripts/generate-table.ts`. The generated module embeds
the index as a base64-encoded little-endian `Uint16` array keyed by Shift_JIS
pointer, and the runtime builds both the decode array and the encode map from it
at module load. Regenerate it with:

```sh
bun run generate:table
```

## License

MIT
