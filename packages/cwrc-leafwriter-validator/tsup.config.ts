import { defineConfig } from 'tsup';

export default defineConfig({
  name: 'LEAF-WRITER-validator',
  clean: true,
  dts: true,
  entry: ['src/index.worker.ts'],
  format: ['cjs', 'esm'],
  minify: true,
  outDir: 'lib/',
  shims: true,
});
