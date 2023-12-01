# CHANGELOG

## 4.3.0

### Minor Changes

- [6a126413cfaec79f518a3e673ac12009d2410219] Add method to clear indexedDB cache

### Patch Changes

- Tests:
  - [754bd483af5855b0596fd5985274bc2f64b61f9b] Add test Clear cache
- Documention
  - [1e222a980922161f87d2e6b9196a8ec40601f96e] Add documentation on the `clear cache` method
- Maintenance
  - [33761ce22b414afd503a4a63241e28f8517f36b5] Coalesce tsconfig in the package
  - [6c537699ac3fc86d185030961c146c793ce16bab] Update dist
  - [eac8d3c472220296050cb4270f071e7cf8b52bbe] Update dependencies
    - dev:
      - fix: tsup@7.2.0 (due to compatibility issues)
      - update:
        - @types/node@20.10.1
        - eslint@8.54.0
      - bump:
        - @types/jest@29.5.10
        - @types/jsdom@21.1.6
        - @types/lodash@4.14.202
        - @types/mocha@10.0.6

## 4.2.1

### Patch Changes

- [7529683795cb209289b7b193bb4e1b083b4e660a] use tsup to build the library
- [6d79340153a76c9aa19a78128ccd5353ac5f8a3d] update dependencies
  - dev:
    - add:
      - ts-node@10.9.1
      - typedoc@0.25.3
    - bump
      - @types/jest@29.5.7
      - @types/node@20.8.10

## 4.2.0

### Minor Changes

- [4d7c41ef46861e86dfb38fc09011a864df16532a] stop emiting leafwriter-validator.db in the dist folder

### Maintenance

- [3b1f4fb96545f335b38a1c6e31ea4dec6bb618b3] update dependencies
  - dev: bump: @types/node@20.8.9

## 4.1.2

## Chore

- [2982fa8f973c77dcbfdf36c4da9bddc6bdbe061a] Esbuild-loader: load tsconfig automatically
  - update `esbuild-loader` to 4.0.2
- [8dbea6c53c78e3526d8806e34cd9e82b6a4f38e1] TestEnvironment: workaraound to make `structuredClone` work on `jsdom`
  - Caused by `test-environment-jsdom` new version
  - update `test-environment-jsdom` to 29.7.0
- [e5e1f9ac03eaa0f1c9930abc7fd4434d0d0d72d5] Centralize `eslint` and `prettier`
  - add dependency to internal the pacakge `eslint-config-custom`
  - remove dependencie to `eslint-config-prettier` and `eslint-plugin-prettier`
- [c9e8b1bccdaf81482721ded06a5438f094ba5c23] Centralize tsconfig
  - add dependency to internal the pacakge `tsconfig`
  - Simplify tsconfig + [552641368f5a8ac8af73fcb45811bd04661285b0]

### Test

- [017548b7cf96cf3b488c3565d2f822764e8f86b5] Temporarily skip a test
  - getValuesForTagAttributeAt

### Maintance

- Remove unnecessary files
  - [1daa7745a93840cfc381dfe4e0cf98fac197b2b5] issue_template.md
  - [ca9b1154c8bb1d9afdcceea657dfc2306abc9c99]
    - .prettierrc
    - changelog.config.js
    - temp files
- Linting, formating, typing
  - [e006a25690e176936a42515fd55fd68983194831]
  - [797c14a421413ddbe206c36793a48d93592f1a11]
  - [7af054c88903125761cf82a3da676e290c5bdcb4]
  - [45773daee50a378712e0810e304f0eee3068cf31]
- [66f7f49514cb13c7205815a9c9e69b4d8508292a] Update dependencies
  - dev:
    - remove:
    - @typescript-eslint/eslint-plugin
    - @typescript-eslint/parser
    - commitizen
    - git-cz
    - husky
    - prettier
    - webpack-cli
  - add:
    - @types/node@20.8.7
    - eslint@8.52.0
    - typedoc@0.25.2
  - update:
    - @jest/globals@29.7.0
    - jest@29.7.0
    - typescript@5.2.2
    - webpack@5.89.0
  - bump:
    - @types/jest@29.5.6
    - @types/jsdom@21.1.4
    - @types/lodash@4.14.200
    - @types/mocha@10.0.3

## 4.1.1

### Patch Changes

- Fix the export path and remove the unused file[456a1f4ac790117b3123642193438d84f73bd3f0] [b435966050545a1fd464e553b34dc1e285d3be12]
- Bump up jsdom to 21.1.2 [9bf73f0ab3a1a91482035ba1eacb77c2c72cf203]
  - **Waning**: jsom v21.1.2 is the latest that has support to be browserified. v.22.0.0 remove this support. Check here: [https://github.com/jsdom/jsdom/releases/tag/22.0.0](https://github.com/jsdom/jsdom/releases/tag/22.0.0) [799d90e53bfcd4bc54e6c6a7919dd339f29b284a]\
- Adjust typescript config [ffc2c89f4e56dcaf2f5f991b0bd9a80ecbe73221]
- Update Dependencies [f4826aa03c58fdc4c4cc8d4bbc535fec406aae8b]:
  - core:
    - bump: dexie@1.8.1
    - dev:
      - upgrade: prettier@3.0.0
      - update:
        - @jest/globals@29.6.1
        - @typescript-eslint/eslint-plugin@5.61.0
        - @typescript-eslint/parser@5.61.0
        - eslint@8.44.0
        - jest-environment-jsdom@29.6.1
        - typescript@5.1.6
        - webpack@5.88.1
        - webpack-cli@5.1.4
      - bump:
        - @types/jest@29.5.2
        - @types/lodash@4.14.195
        - ts-jest@29.1.1
        - typedoc@0.24.8

## 4.1.0

### Minor Changes

- Exports: narrow db exports [a30952af480f16d604ef6c052e1cd3903fb387d4]

## 4.0.0

### Major Changes

Export `clearCache` and `deleteDb` functions independently from the webworker.

BREAKING CHANGE: 🧨 These functions are no longer exported from index.worker. You should use the second-level path `/db` to access them.
E.g.: `import { clearCache } from '@cwrc/leafwriter-validator/db`

- Export clearCache and deleteDb independently from the webworker [3f1ba2d4e1d89aa2171ba230d9a47d3ad940e5e4]

### Patch Changes

- Update dependencies [09ddf67278c728ffe94e8371816fd18430647e0f]
  - dev:
    - update:
      - @typescript-eslint/eslint-plugin@5.59.0
      - @typescript-eslint/parser@5.59.0
      - eslint@8.38.0 webpack@5.79.0
    - bump:
      - @types/lodash@4.14.194 typedoc@0.24.4

## 3.0.0

## New Features

### New caching and storage strategy

Refactoring the conversion and caching process. LEAF-Writer Validator now saves cache on the browser indexedDB.

This fixes a mistake where the hash of the file was not properly compared with the incoming file.
The schema is now cached on the indexedDB, which there is much more space than the localStorage.
As such, we do not need to compress Salve’s processed file. IndexedDB is available to web workers (local storage is not).
Thus, the validator will not pass the processed schema back to LEAF-Writer. It will prepare, store, and retrieve the cached schema itself.

BREAKING CHANGE: 🧨 Changes the `initialize` parameters and response.

Initialize takes an object with two main properties: `id` and `url`. It returns another object with the property `success` (boolean).
No need to exchange a stringified version or handle caching. The validator does it by itself.

Check documentation for more info.

## Major Changes

- Refactoring conversion and caching. LW-Validator now saves cache on the brower indexedDB [a52f29d9f97f7861b23d546dd912f2a5a295b967]

## Patch Changes

- Build
  - Build documentation when publishing new version [3658aac98c910b76e91073cf9dbae7c40e411f89]
  - Lint: Remove mention to `plugin:react/recommended` on eslint [1f841c42854f1de23698d09a5adc10040cde6ac9]
  - Webpack: no need to ingest `jsx` or `tsx` files [4c0acd8c5f8b84c065b4c9701965bba0abc66695]
- Update dependencies
  - dev:
    - remove unused: ts-loader [f5f7f7937f9332283a99e5965972d4a697993869]
    - add missing: @jest/globals [f5f7f7937f9332283a99e5965972d4a697993869]
    - update:
      - @typescript-eslint/eslint-plugin@5.57.1 [1023ac387925a73ea09d945b79f9f5f038b65806]
      - @typescript-eslint/parser@5.57.1 [1023ac387925a73ea09d945b79f9f5f038b65806]
      - eslint@8.37.0 ts-jest@29.1.0 [1023ac387925a73ea09d945b79f9f5f038b65806]
      - webpack@5.78.0 [f5f7f7937f9332283a99e5965972d4a697993869]
    - bump up: [f5f7f7937f9332283a99e5965972d4a697993869]
      - @types/lodash@4.114.192
      - typescript@5.0.4

## 2.0.0

### What's new?

#### Improved speculative validation

Fix a bug preventing speculative validation on different intended actions (add before, add after, add around, add inside, add a tag, change a tag). This caused the list of possible tags to include some elements that would invalidate the document as valid. With this fix, you will see more strict behaviour.

#### Return all possible tags with a flag indicating if they are invalid

Instead of having either the possible or valid tags, the validator returns all the possible tags and flags them as either valid or invalid. This feature makes it easier to filter invalid tags based on user intention. Previously, LEAF-Writer only used valid tags as suggestions for a given context. Now it shows all the possible tags, visually flagging the invalid ones and letting the user show/hide them. To provide a concrete example, the tags `biblFull` and `biblStruct` never showed up as an option to add a tag before a `p`. Even though they are possible in `p`, they have specific requirements (e.g. `biblFull` requires `biblStruct` as a child). Now, LEAF-Writer shows all possible tags and allows users to add and, consequently, invalidate their document, which they would subsequently be warned by the validator and have a chance to fix the problem or save it as is.

### The `textNode` is also available

Previous behaviour filtered `textNode` out of the possible tags (since it is not a tag). Now, the `textNode` returns as possible (and speculatively validated) together with the other tags. The `textNode` is identified with the type `text`.

## API changed

Because of these improvements, this version contains changes to some API calls and their response. Check the readme file to see more.

### Major Changes

- Change API to coalesce results, allows for textNode validation, and fix bugs [ed8a5959c0aed5fcd803fb566072e5c6d71adc2d]
  - When speculativelly valdiating, possible tags have an extra property 'invalid' (boolean) intead of a second array listing speculative validated tags. This also fix a bug that prevent validation on different modes of speculations (before, after, ...). Another change is the addition of textNodes as possible "tags" events .
- [TEST] Refactor tests [bb16b3542f14ffa514f7a8ad3a377d22b5929309]
- [DOCS] Update new API documentation [ac22867462a05ce202c5a271e615365e4f818f65]

### Patch Changes

- Add more strict types [e6c2bde00805a24c2a00234a6914fa7dd9e5ef11]
- Update jsdom to 21.1.1 [4bf920b881ab4a2b253f9494398ad5a1f95bff8d]
- Updage dependencies [bc76b6ce00d8a1fbcc00671475228225714e6d20]
  - dev:
    - upgrade: typescript@5.0.2
    - update:
      - @types/jest@29.5.0
      - @typescript-eslint/eslint-plugin@5.56.0
      - @typescript-eslint/parser@5.56.0
      - eslint-config-prettier8.8.0
    - bump up:
      - prettier@2.8.7
      - typedoc@0.23.28
      - webpack@5.76.3

## 1.2.4

### Patch Changes

- Fix EsbuildPlugin minify config [ac63c0591ddc12901a535bbc50ade4689ae87af5]
- Update dependencies
  - dev:
    - update:
      - @typescript-eslint/eslint-plugin@5.54.1 [7c448766cb72c355e47528e73b57ffe3b875c592]
      - @typescript-eslint/parser@5.54.1 [7c448766cb72c355e47528e73b57ffe3b875c592]
      - eslint@8.36.0 [7c448766cb72c355e47528e73b57ffe3b875c592]
      - eslint-config-prettier@8.7.0 [7c448766cb72c355e47528e73b57ffe3b875c592]
      - jest@29.5.0 [7c448766cb72c355e47528e73b57ffe3b875c592]
      - jest-environment-jsdom@29.5.0 [7c448766cb72c355e47528e73b57ffe3b875c592]
      - webpack@5.76.2 [81e6fcdc645926e22870b8fe540bf8e4ac59bb88]
    - bump up:
      - @types/jest@29.4.4 [81e6fcdc645926e22870b8fe540bf8e4ac59bb88]
      - prettier@2.8.4 [7c448766cb72c355e47528e73b57ffe3b875c592]
      - typedoc@0.23.26 [7c448766cb72c355e47528e73b57ffe3b875c592]

## 1.2.3

### Patch Changes

- webpack update esbuild configurations [11420bfb4a67abde43bdd808488ecbb15dc8e40d]
- update dependencies [4d992313a67fdb88ac333ecf9902c628e1c43dc8]
  - core:
    - bump up: comlink@4.4.1
  - dev:
    - upgrade:
      - @types/jsdom@21.1.0
      - esbuild@3.0.1
    - update:
      - @typescript-eslint/eslint-plugin@5.52.0
      - @typescript-eslint/parser@5.52.0
      - eslint@8.34.0
    - bump up:
      - jest@29.4.3
      - jest-environment-jsdom@29.4.3
      - typedoc@0.23.25
    - peerDependencies:
      - bump up: comlink@4.4.1

## 1.2.2

### Patch Changes

- rebuild jsdom [v.21.1.0] (browserify)
- update dependencies [3142f5d6d223f2cdd4443931dd8dee476f81d803]
  - core: update: comlink@4.4.0
  - dev:
    - upgrade: jsdom@21.1.0
    - update:
      - @types/jest@29.4.0
      - @typescript-eslint/eslint-plugin@5.50.0
      - @typescript-eslint/parser@5.50.0
      - commitizen@4.3.0
      - esbuild-loader@2.21.0
      - eslint-config-prettier@8.6.0
      - jest@29.4.1
      - jest-environment-jsdom@29.4.1
    - bump up:
      - husky@8.0.3
      - prettier@2.8.3
      - ts-jest@29.0.5
      - typedoc@0.23.24
      - typescript@4.9.5
      - webpack-cli@5.0.1
  - peerDependencies: comlink@4.4.0

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
