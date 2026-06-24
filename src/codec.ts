// The codec contract and the registry that backs the plugin model. A codec is
// just a name plus the two byte<->string directions; extra encodings ship as
// their own modules exporting a Codec and are pulled in only when imported,
// so the base bundle stays limited to what `index.ts` registers by default.

/** Controls how an encoder handles characters the target cannot represent. */
export type OnUnmappable = "replace" | "throw";

export interface EncodeOptions {
  /**
   * Behaviour for a character with no mapping in the target encoding.
   * "replace" (the default) emits "?" (0x3F); "throw" raises an error.
   * Ignored by encodings, such as UTF-8, that can represent every character.
   */
  onUnmappable?: OnUnmappable;
}

/** A reversible mapping between a string and bytes in one encoding. */
export interface Codec {
  /** The lookup name, e.g. `"shift_jis"`. Used as the registry key. */
  readonly name: string;
  /** Encodes a string into bytes in this encoding. */
  encode(text: string, options?: EncodeOptions): Uint8Array;
  /** Decodes bytes in this encoding into a string. */
  decode(input: Uint8Array): string;
}

const registry = new Map<string, Codec>();

/**
 * Registers a codec so it can be referenced by name in `convert`, `encode` and
 * `decode`. Re-registering a name replaces the previous codec.
 */
export function registerCodec(codec: Codec): void {
  registry.set(codec.name, codec);
}

/** Returns the codec registered under `name`, or `undefined` if none is. */
export function getCodec(name: string): Codec | undefined {
  return registry.get(name);
}

/** Returns the names of every currently registered codec. */
export function listCodecs(): string[] {
  return [...registry.keys()];
}

/**
 * Resolves an encoding argument that is either a codec or a registered name.
 * Throws a directed error when a name has not been registered, since the most
 * common cause is forgetting to import and register an optional codec.
 */
export function resolveCodec(encoding: string | Codec): Codec {
  if (typeof encoding !== "string") {
    return encoding;
  }
  const codec = registry.get(encoding);
  if (codec === undefined) {
    throw new Error(
      `Unknown encoding "${encoding}". Register its codec with registerCodec(), ` +
        `or pass the codec object directly. Registered: ${listCodecs().join(", ")}`,
    );
  }
  return codec;
}
