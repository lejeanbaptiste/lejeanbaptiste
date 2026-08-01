import { defineConfig, type Options } from 'tsup';

const isDev = process.env.NODE_ENV === 'development';

const shared: Options = {
  clean: true,
  entry: ['src-server/index.ts'],
  outDir: 'server/',
  shims: true,
  watch: isDev,
  // Bundle runtime deps so the packaged desktop app doesn't need node_modules.
  noExternal: [
    'compression',
    'express',
    'helmet',
    'kleur',
    '@xmldom/xmldom',
    'office-addin-dev-certs',
  ],
};

const esmConfig: Options = {
  ...shared,
  name: 'Commons-Server-esm',
  format: ['esm'],
  clean: false,
  // CJS deps use require(); provide it in the ESM bundle.
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
};

const cjsConfig: Options = {
  ...shared,
  name: 'Commons-Server-cjs',
  format: ['cjs'],
};

// Dev `tsup --onSuccess "npm run start:dev"` applies to every config entry.
// Building both formats therefore launched two watch servers and caused
// EADDRINUSE races on :3848. Production still needs both bundles.
export default defineConfig(isDev ? [esmConfig] : [cjsConfig, { ...esmConfig, clean: false }]);
