import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/preload.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  external: ['electron'],
  noExternal: ['mammoth', 'jszip', '@xmldom/xmldom', 'electron-updater'],
  splitting: false,
  sourcemap: true,
});
