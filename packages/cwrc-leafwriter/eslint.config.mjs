import custom from 'eslint-config-custom';

export default custom({
  tsconfigRootDir: import.meta.dirname,
  project: ['./tsconfig.eslint.json'],
  ignores: [
    'README.md',
    'test/**',
    // Verbatim TinyMCE skin bundles (tinymce.Resource.add(...) with minified CSS).
    'src/css/tinymce/**',
  ],
});
