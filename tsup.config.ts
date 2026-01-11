import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/commands/**/*.tsx'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: ['react', 'ink', 'cheerio', 'chokidar', 'gradient-string'],
  noExternal: ['chalk', 'conf', 'ink-spinner', 'ink-select-input', 'meow'],
});
