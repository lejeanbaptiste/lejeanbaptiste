## 1.2.0

### Minor Changes

- Skip errors on element #document [8abfd557c8f669859e8d4ca5cded508d83de33dd]

### Patches

- Update jsdom to 20.0.0 [a8e98d7b25e0912172a3d40bbb39a361c8afcc18]
- gitignore should allow /src/lib [bea56cf6a72e1f307673214b2de099c463ce4d04]

### Chore

- Update dependencies [0179500ca5ab1f5ba113124ebe2b86ee4361c7a4]:
  - dev:
    - upgrade:
      - @types/jest@29.0.3
      - @types/jsdom@20.0.0
      - jest@29.0.3
      - jest-environment-jsdom@29.0.3
      - ts-jest@29.0.1
    - update:
      - @typescript-eslint/eslint-plugin@5.37.0
      - @typescript-eslint/parser@5.37.0
      - esbuild-loader@2.20.0
      - eslint@8.23.1
      - typescript@4.8.3
    - bump up:
      - @types/lodash@4.14.185
      - typedoc@0.23.14

## 1.1.0

### Minor Changes

[47f9381]

- [feat] Add log manager
  - We use loglevel to control when to output logs (no more dirty logs on production version).
