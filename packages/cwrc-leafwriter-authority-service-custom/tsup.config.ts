import { defineConfig } from 'tsup';

export default defineConfig({
  name: 'Custom Authority Service',
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  minify: true,
  outDir: 'lib/',
  shims: true,
});
