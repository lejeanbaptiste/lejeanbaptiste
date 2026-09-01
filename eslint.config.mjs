import custom from 'eslint-config-custom';

export default custom({
  tsconfigRootDir: import.meta.dirname,
  ignores: [
    'README.md',
    'test/**',
    'release/**',
    '.claude/**',
    // Each workspace lints itself via its own eslint.config.mjs.
    'apps/**',
    'packages/**',
    // Standalone Cloudflare Worker: own tsconfig + `npm run typecheck`.
    'workers/**',
  ],
});
