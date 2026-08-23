import custom from 'eslint-config-custom';

export default custom({
  tsconfigRootDir: import.meta.dirname,
  project: ['./tsconfig.eslint.json'],
  ignores: [
    'README.md',
    'test/**',
    // esbuild output, gitignored — see `**/commons/server` in the root .gitignore.
    'server/**',
  ],
});
