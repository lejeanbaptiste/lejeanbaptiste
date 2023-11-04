import { defineConfig } from 'tsup';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  name: 'Commons-Server',
  clean: true,
  entry: ['src-server/index.ts'],
  format: ['cjs', 'esm'],
  outDir: 'server/',
  shims: true,
  watch: isDev,
});
