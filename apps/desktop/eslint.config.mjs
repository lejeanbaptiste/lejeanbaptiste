import custom from 'eslint-config-custom';

export default [
  ...custom({
    tsconfigRootDir: import.meta.dirname,
    project: ['./tsconfig.eslint.json'],
    ignores: [
      'README.md',
      // Build config, outside the tsconfig project — same as the validator workspace.
      'tsup.config.ts',
      // electron-builder output.
      'release/**',
      // Bundled third-party runtimes shipped as-is (CPython stdlib and its vendored
      // JS, LemMinX, PMTiles archives) — not our source.
      'resources/**',
    ],
  }),
  {
    // This workspace is the Electron main process — no React anywhere in it. The
    // shared config's react-hooks rules only ever fire here as false positives on
    // plain helpers that happen to be named `use*` (e.g. `useCompileFallback`).
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
