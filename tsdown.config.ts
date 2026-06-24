import { defineConfig } from "tsdown";

export default defineConfig({
  // One entry per public import path. The extra encodings are separate entries
  // so importing `mojiyose` never pulls in their codecs or tables; the shared
  // jis0208 index is emitted as a common chunk rather than duplicated.
  entry: ["src/index.ts", "src/euc-jp.ts", "src/iso-2022-jp.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
