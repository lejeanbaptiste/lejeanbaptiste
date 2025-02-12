import { defineConfig } from 'tsup';

export default defineConfig({
  name: 'LGPN Authority Service',
  clean: true,
  dts: true,
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  minify: true,
  outDir: 'lib/',
  shims: true,
});
