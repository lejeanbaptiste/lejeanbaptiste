module.exports = {
  extends: ['eslint:recommended', 'prettier'],
  env: { es6: true },
  ignorePatterns: ['**/coverage/**/*.*', '**/dist/**/*.*', '**/packages/eslint-*/*.js'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  overrides: [
    {
      env: { node: true },
      files: ['**/.eslintrc.{js,cjs}', '**/.jest-preset.js'],
      parserOptions: { sourceType: 'script' },
    },
    {
      env: { node: true },
      files: ['**/*.ts'],
      extends: [
        'eslint:recommended',
        //* For more relaxed TS rules, uncommend next 2 lines and comment the following 2.
        // 'plugin:@typescript-eslint/recommended',
        // 'plugin:@typescript-eslint/stylistic',
        'plugin:@typescript-eslint/recommended-type-checked',
        'plugin:@typescript-eslint/stylistic-type-checked',
        'prettier',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json'],
      },
      plugins: ['@typescript-eslint', 'prettier'],
      rules: {
        '@typescript-eslint/ban-ts-comment': 1,
        '@typescript-eslint/no-explicit-any': 1,
        '@typescript-eslint/require-await': 0,
      },
    },
    {
      files: ['**/*.md'],
      processor: 'markdown/markdown',
      plugins: ['markdown'],
      extends: ['eslint:recommended', 'plugin:markdown/recommended', 'prettier'],
    },
    {
      files: ['**/*.md/*.ts'],
      rules: { strict: 'off' },
    },
    {
      env: { node: true },
      files: ['**/*.yml', '**/*.yaml'],
      extends: ['eslint:recommended', 'plugin:yml/standard', 'plugin:yml/prettier', 'prettier'],
      rules: { 'yml/no-empty-mapping-value': 0 },
    },
  ],
};
