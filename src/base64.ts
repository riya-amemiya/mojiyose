// Shared helpers for turning the base64-embedded index tables back into typed
// arrays at runtime. Keeping this in one place lets every codec table reuse the
// same decoder rather than each shipping its own.

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Reach Buffer through globalThis so browser bundlers do not polyfill it.
  const nodeBuffer = (
    globalThis as {
      Buffer?: { from(input: string, encoding: string): Uint8Array };
    }
  ).Buffer;
  if (nodeBuffer) {
    return Uint8Array.from(nodeBuffer.from(base64, "base64"));
  }
  throw new Error("No base64 decoder is available in this environment");
}

/**
 * Decodes a base64 string that packs `length` little-endian Uint16 values
 * (an index table keyed by pointer) into a `Uint16Array`.
 */
export function unpackUint16Table(base64: string, length: number): Uint16Array {
  const bytes = base64ToBytes(base64);
  const table = new Uint16Array(length);
  for (let i = 0; i < length; i++) {
    table[i] = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
  }
  return table;
}
