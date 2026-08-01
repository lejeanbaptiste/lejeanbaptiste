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
  // Keep Node's built-in SQLite module as a built-in import. Without this,
  // esbuild rewrites `node:sqlite` to `sqlite`, which is not an installed
  // dependency and prevents the packaged main process from starting.
  external: ['electron', 'node:sqlite'],
  noExternal: ['mammoth', 'jszip', '@xmldom/xmldom', 'electron-updater', 'pmtiles'],
  splitting: false,
  sourcemap: true,
});
