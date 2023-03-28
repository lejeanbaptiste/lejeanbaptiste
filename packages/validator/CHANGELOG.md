# CHANGELOG

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
