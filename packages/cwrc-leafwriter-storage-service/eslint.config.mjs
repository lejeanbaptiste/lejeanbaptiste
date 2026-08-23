import custom from 'eslint-config-custom';

export default custom({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['README.md', 'test/**', 'tsup.config.ts'],
});
