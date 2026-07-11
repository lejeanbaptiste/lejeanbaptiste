import { defineConfig } from 'tsup';

const isDev = process.env.NODE_ENV === 'development';

const shared = {
  clean: true,
  entry: ['src-server/index.ts'],
  outDir: 'server/',
  shims: true,
  watch: isDev,
  // Bundle runtime deps so the packaged desktop app doesn't need node_modules.
  noExternal: ['compression', 'express', 'helmet', 'kleur'],
} as const;

export default defineConfig([
  {
    ...shared,
    name: 'Commons-Server-cjs',
    format: ['cjs'],
  },
  {
    ...shared,
    name: 'Commons-Server-esm',
    format: ['esm'],
    clean: false,
    // CJS deps use require(); provide it in the ESM bundle.
    banner: {
      js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
    },
  },
]);
