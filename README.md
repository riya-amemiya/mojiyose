# mojiyose

A tiny, dependency-free TypeScript library that converts byte sequences between
Japanese legacy encodings and UTF-8.

The base import handles Shift_JIS, UTF-8, and UTF-8 without a byte order mark.
EUC-JP and ISO-2022-JP ship as separate imports so the default bundle never
pays for codecs it does not use, and any number of further encodings can be
added through the same plugin model.

The UTF-8 side uses the platform `TextEncoder` / `TextDecoder`. The legacy side
is implemented from the WHATWG Encoding Standard's indexes, with the same table
driving both encoding and decoding, so the mapping is identical in every runtime
rather than depending on the host's ICU build. Shift_JIS, EUC-JP and ISO-2022-JP
all share the single jis0208 index, so adding the latter two costs almost no
extra table data. There are no runtime dependencies, and each import ships only
the tables it needs.

## Install

```sh
npm install mojiyose
```

## Encodings

The base import registers three encodings, referenced by string literal:

**`"shift_jis"`**：Shift_JIS (JIS X 0208), the byte mapping defined by the
WHATWG Encoding Standard.

**`"utf-8"`**：UTF-8 without a byte order mark. This is the canonical meaning of
"UTF-8".

**`"utf-8-bom"`**：UTF-8 prefixed with the `EF BB BF` byte order mark.

Two more Japanese encodings ship as their own imports and are added through the
plugin model described below:

**`"euc-jp"`** (`mojiyose/euc-jp`)：EUC-JP, including the three-byte JIS X 0212
plane on the decode side.

**`"iso-2022-jp"`** (`mojiyose/iso-2022-jp`)：the stateful, escape-based
ISO-2022-JP.

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

## Extra encodings

Encodings beyond the three built-ins are **codecs**: small modules that export a
`Codec` object and are imported on their own. Importing `mojiyose` never loads
them, so the default bundle stays limited to Shift_JIS and UTF-8.

A codec can be used in two ways. Pass the codec object straight to `convert`,
`encode`, or `decode`:

```ts
import { convert } from "mojiyose";
import { eucJp } from "mojiyose/euc-jp";

const utf8 = convert(eucJpBytes, eucJp, "utf-8");
```

Or register it once and refer to it by name everywhere afterwards:

```ts
import { convert, registerCodec } from "mojiyose";
import { iso2022Jp } from "mojiyose/iso-2022-jp";

registerCodec(iso2022Jp);
const utf8 = convert(isoBytes, "iso-2022-jp", "utf-8");
```

Registration is an explicit call rather than an import side effect, so the
codecs stay tree-shakeable. Each module also exports its lower-level functions:
`eucJpEncode` / `eucJpDecode` and `iso2022JpEncode` / `iso2022JpDecode`.

### Writing a codec

A `Codec` is a name plus the two directions, so a custom encoding is just an
object:

```ts
import { type Codec, registerCodec } from "mojiyose";

const myCodec: Codec = {
  name: "my-encoding",
  encode(text, options) {
    /* string -> Uint8Array */
  },
  decode(input) {
    /* Uint8Array -> string */
  },
};

registerCodec(myCodec);
```

`registerCodec(codec)` adds it, `getCodec(name)` returns a registered codec, and
`listCodecs()` lists the registered names.

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

The legacy encodings cannot represent every character. The `options.onUnmappable`
setting controls what `encode` and `convert` do when a target encoding hits one;
it is ignored for UTF-8, which represents everything:

```ts
encode("😀", "shift_jis"); // default "replace" -> a "?" (0x3F) byte
encode("😀", "shift_jis", { onUnmappable: "throw" }); // throws instead
```

ISO-2022-JP additionally cannot encode half-width katakana, since its encoder
has no katakana state; those characters are treated as unmappable too. On
`"replace"` the encoder first returns to the ASCII state so the `"?"` byte stays
unambiguous.

### Lower-level Shift_JIS access

`shiftJisEncode(text, options?)` and `shiftJisDecode(input)` are exported for
callers that only need the Shift_JIS codec.

## How the tables are built

`src/jis0208-table.ts` and `src/jis0212-table.ts` are generated from the
canonical WHATWG `index-jis0208.txt` and `index-jis0212.txt` by
`scripts/generate-table.ts`. Each generated module embeds its index as a
base64-encoded little-endian `Uint16` array keyed by pointer, and the runtime
builds the decode array and encode map from it at first use. jis0208 is shared
by the Shift_JIS, EUC-JP and ISO-2022-JP codecs; jis0212 is loaded only by
`mojiyose/euc-jp`. Regenerate both with:

```sh
bun run generate:table
```

## License

MIT
