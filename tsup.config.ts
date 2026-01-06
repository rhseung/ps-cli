import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: ["react", "ink", "cheerio"],
  noExternal: [
    "chalk",
    "chokidar",
    "conf",
    "execa",
    "gradient-string",
    "ink-spinner",
    "ink-select-input",
    "meow",
  ],
});
