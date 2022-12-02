# CHANGELOG

## 1.2.1

### Patch

- bump up jsdom to 20.0.3 [1ec93cd8a8cc3872402df372c11c830695a50f4e]
- Fix variable type. Remove @type-ignore [ac9b52790e297a6203b6b90ea83c91f5555084a6]
- update dependencies [6263a7808677665b3442fb2dee42cc9781c9a59f]:
  - core:
    - bump up: loglevel@1.8.1
  - dev:
    - upgrade: webpack-cli@5.0.0
    - update:
      - @types/jest@29.2.3
      - @typescript-eslint/eslint-plugin@5.45.0
      - @typescript-eslint/parser@5.45.0
      - eslint@8.28.0 jest@29.3.1
      - jest-environment-jsdom@29.3.1
      - prettier@2.8.0
      - typescript@4.9.3
      - webpack@5.75.0
    - bump up:
      - @types/jsdom@20.0.1
      - @types/lodash@4.14.191
      - husky@8.0.2 jsdom@20.0.3
      - ts-loader@9.4.2
      - typedoc@0.23.21

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
