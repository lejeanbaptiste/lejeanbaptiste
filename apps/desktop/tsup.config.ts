import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'tsup';

const copyWikisourceRuntime = () => {
  const destDir = path.join('dist', 'wikisource');
  mkdirSync(destDir, { recursive: true });
  for (const name of [
    'wikisource-parallel.mjs',
    'wikidata.mjs',
    'wikitextToTei.mjs',
    'wikisourceImport.mjs',
  ]) {
    copyFileSync(path.join('src', 'wikisource', name), path.join(destDir, name));
  }
};

const copyBdrcRuntime = () => {
  const destDir = path.join('dist', 'bdrc');
  mkdirSync(destDir, { recursive: true });
  for (const name of [
    'bdrcImport.mjs',
    'pdiClient.mjs',
    'etextToTei.mjs',
    'bdrcRef.mjs',
    'bdrcCache.mjs',
  ]) {
    copyFileSync(path.join('src', 'bdrc', name), path.join(destDir, name));
  }
};

export default defineConfig({
  entry: ['src/main.ts', 'src/preload.ts', 'src/bulkBridgeWorker.ts', 'src/entityIndexWorker.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  onSuccess: async () => {
    copyWikisourceRuntime();
    copyBdrcRuntime();
  },
  // Keep Node's built-in SQLite module as a built-in import. Without this,
  // esbuild rewrites `node:sqlite` to `sqlite`, which is not an installed
  // dependency and prevents the packaged main process from starting.
  external: ['electron', 'node:sqlite'],
  noExternal: ['mammoth', 'jszip', '@xmldom/xmldom', 'electron-updater', 'pmtiles'],
  splitting: false,
  sourcemap: true,
});
