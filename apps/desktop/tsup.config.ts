import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/main.ts',
    'src/preload.ts',
    'src/bulkBridgeWorker.ts',
    'src/entityIndexWorker.ts',
  ],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  external: ['electron'],
  noExternal: ['mammoth', 'jszip', '@xmldom/xmldom', 'electron-updater', 'pmtiles'],
  splitting: false,
  sourcemap: true,
});
