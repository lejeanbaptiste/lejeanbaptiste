import { defineConfig } from 'tsup';

export default defineConfig({
  name: 'LEAFWRITER-storage-service',
  clean: true,
  dts: true,
  entry: ['src/index.tsx', 'src/headless.ts', 'src/StorageDialog.tsx'],
  format: ['cjs', 'esm'],
  outDir: 'lib/',
  shims: true,
});
