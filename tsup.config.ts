import { defineConfig } from "tsup";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: process?.env?.TSUP_SOURCEMAP === "true",
  clean: true,
  target: "es2019",
  splitting: false,
  treeshake: true,
  external: ["react"],
});
