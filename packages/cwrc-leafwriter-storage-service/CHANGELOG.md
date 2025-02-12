# CHANGELOG

## 4.0.1

### Patch Changes

- [8000744f6e641324b90f9b270b3b5604d1f5caf6] update dependencies
  - core:
    - add: zod@3.24.1
    - upgrade: date-fns@4.1.0 uuid@11.0.5
    - update:
      - @emotion/react@11.14.0
      - @emotion/styled@11.4.0
      - @mui/base@5.0.0-beta.68
      - framer-motion@11.18.2
      - i18next@23.16.8
      - react-dropzone@14.3.5
      - react-i18next@15.4.0
      - react-icons@5.4.0
      - react-use@17.6.0
    - bump:
      - @mui/icons-material@5.16.14
      - @mui/material@5.16.14
      - axios@1.7.9
      - dexie@4.0.11
      - loglevel@1.9.2
      - mdi-material-ui@7.9.3
      - mui-modal-provider@2.4.6 [43260e1da5efdf14c4741f7c091a39eaf31b551b]
      - zod@3.24.2 [43260e1da5efdf14c4741f7c091a39eaf31b551b]
  - dev:
    - remove:
      - @octokit/types
      - jest-environment-jsdom
      - process
      - shx
    - update:
      - @testing-library/jest-dom@6.6.3
      - @testing-library/react@16.2.0
      - @testing-library/user-event@14.6.1
      - @types/node@22.13.1 [43260e1da5efdf14c4741f7c091a39eaf31b551b]
      - tsup@8.3.6
      - typedoc0.27.7 [43260e1da5efdf14c4741f7c091a39eaf31b551b]
      - typescript@5.7.3
    - bump:
      - @types/jest@29.5.14
      - @types/lodash@4.17.15 [43260e1da5efdf14c4741f7c091a39eaf31b551b]
      - @types/mocha@10.0.10
      - @types/react@18.3.5
      - eslint@8.57.1
      - ts-jest@29.2.5


## 4.0.0

### Major Changes

See changes below (4.0.0-beta.1 and 4.0.0-beta.0)

## 4.0.0-beta.1

### Major Changes

- [b6bdeb06c1ce3918dfa96b2594e374a29889f995] **Locale**:
  - Add support for Spanish, Portuguese, Romanian, and German
  - BREAKING CHANGE: 🧨 Rename config property: `language` -> `locale`

### Patch Changes

- [8000744f6e641324b90f9b270b3b5604d1f5caf6] Rename files using kebab case; use import alias `@src/`; rename locale namespace
- [5865fff19b2a7ce0a082f112a49a5a2470f6b9db] Update dependencies
  - core:
    - upgrade: react-i18next@15.0.1 [06be0ddbf6c2e4250e2ef05cdb5c8f2b966ab4c2]
    - update:
      - @emotion/react@11.13.0
      - @emotion/styled@11.13.0
      - @mui/lab@5.0.0-alpha.173
    - bump:
      - @mui/icons-material@5.16.7 [06be0ddbf6c2e4250e2ef05cdb5c8f2b966ab4c2]
      - @mui/material@5.16.7 [06be0ddbf6c2e4250e2ef05cdb5c8f2b966ab4c2]
      - @octokit/rest@20.1.1
      - axios@1.7.3 [55917a4cc6d657f4280dbb67ab969744c5996290]
      - framer-motion@11.3.21
      - i18next@13.12.12
      - react-use@17.5.1
  - dev:
    - add:
      - @testing-library/dom@10.4.0
      - @types/react@18.3.3
      - @types/react-dom@18.3.0
    - upgrade:
      - @testing-library/react@16.0.0
      - @types/node@22.2.0 [06be0ddbf6c2e4250e2ef05cdb5c8f2b966ab4c2]
    - update: tsup@8.2.4 [55917a4cc6d657f4280dbb67ab969744c5996290]
    - bump:
      - @testing-library/jest-dom@6.4.8
      - ts-jest@29.2.4
      - typedoc@0.26.5
      - typescript@5.5.4

## 4.0.0-beta.0

### Major Changes

- [33d0e19899adbb79ba43848fdb5956c76e0b535b] Simplify locales by removing the country code
  BREAKING CHANGE: 🧨 the language options accept locales with 2-letters code instead of 4. For example: `en` instead of `en-CA`

### Minor Changes

- [af7c449f454581848d611759fed3e84462aae766] Rename type `LanguageCode` as `Locales`
- [100fd60aa5ddeafb284f25b2f44d8c39b1f1e842] Relax language value (string)
- [b2bc8459c6c8c419d825c7a8be0a1834fbd9a80f] Localization: add new term

### Patch Changes

- [c18a6ade51526c53486d712e7028e185d906e59b] Add ids to dialogs
- [e038139362e18a450f81f0e1f7af56b2b3ae537b] Dialogbar: test of dialog exist before add new
- [f43b36d9f967c8524b24c11711ae90f897d2b4a6] Alert dialog: remove icon color

- \_\_

## 3.1.0

### Minor Changes

- [2e625a717b3b12a0c09bc9a008cdc0880acac322] Better error handling when saving. Returns an object instead of thowning error (#135 #200)
- [a72ee887f5bc60bf00b234c5d1c758c633fa9624] Github: produce error mesage if `createOrUpdateFileContents` return 403-forbiden (#135 #200)

### Patch Changes

- [011297f3120b18fe7921b78bd630e6b2365ddd8a] github: fix loading from possibe outdated document from cache (#203)
- Improve typing [73a50ec071de1970dcf0d86d8e255c9c9d2c5ce8] [f08aa79e03bdcc68adf93adda4a624b15eeb89bc] [b8a9d3642b3f810ae7273c09a0ffdef94e030be3]

### Chore

- [e95ec8fa930395aee47828a8d5aeeaae38e8e74f]fix i18next call to work with i18ally
- update dependencies:

  - core:
    - upgrade:
      - octokit/rest@20.1.0 [18f68dd9b6b848b580a2836340a801ec96c1365c]
      - date-fns@3.6.0 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - dexie@4.0.4 [2ae5593b0cefd0f65101bcdb4dec7f2854bf1adc]
      - framer-motion@11.0.18 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - react-i18next@14.1.0 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - react-icons@5.0.1 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
    - update:
      - @mui/base@5.0.0-beta.40 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - @mui/icons-material@5.15.14 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - @mui/lab@5.0.0-alpha.169 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - @mui/material@5.15.14 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - i18next@23.11.1 [18f68dd9b6b848b580a2836340a801ec96c1365c]
      - loglevel@1.9.1 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - mdi-material-ui@7.8.0 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - mui-modal-provider@2.4.2 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - react-use@17.5.0 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
    - bump:
      - @emotion/styled@11.11.5 [18f68dd9b6b848b580a2836340a801ec96c1365c]
      - @mui/icons-material@5.15.15 [18f68dd9b6b848b580a2836340a801ec96c1365c]
      - @mui/lab@5.0.0-alpha.170 [18f68dd9b6b848b580a2836340a801ec96c1365c]
      - @mui/material@5.15.15 [18f68dd9b6b848b580a2836340a801ec96c1365c]
      - framer-motion@11.0.27 [142a21a5cb70a098c3a9807ac2de3157d6c7bcce]
      - axios@1.6.8 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - dexie@3.2.7 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
  - dev:
    - upgrade: @octokit/types@13.4.0
    - update:
      - @octokit/types@12.6.0 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - @testing-library/jest-dom@6.4.2 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - @testing-library/react@14.3.0 [18f68dd9b6b848b580a2836340a801ec96c1365c]
      - @types/lodash@4.17.0 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - @types/node@20.11.30 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - eslint@8.57.0 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - typescript@5.4.3 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
    - bump:
      - @testing-library/user-event@14.5.2 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - @types/jest@29.5.12 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - @types/node@20.12.7 [18f68dd9b6b848b580a2836340a801ec96c1365c]
      - fake-indexeddb@5.0.2 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - ts-jest@29.1.2 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - ts-node@10.9.2 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - tsup@8.0.2 [790d1d096dc00640fd8a11ec8ffaf078e7e712af]
      - typedoc@0.25.13 [18f68dd9b6b848b580a2836340a801ec96c1365c]
      - typescript@5.4.5 [142a21a5cb70a098c3a9807ac2de3157d6c7bcce]

- \_\_

## 3.0.1

### Patch Changes

- [71b909f8b22f0b47aef25b18e6aaee46e842fc0a] Format
- Documantation
  - [6ab2e0f3e184aecd615ab3a1f840503a567afc9f] Fix typo
- Maintenance
  - [4fc1ead2eb1b64355be0bd45b8dda2bbe05d4e68] Coalesce tsconfig in the package
  - [0712bc9d58bca1a471049bc03c2e8ff9e3c15827] Update dependencies
    - core:
      - update:
        - @mui/base@5.0.0-beta.25
        - @mui/lab@5.0.0-alpha.154
        - i18next@23.7.7
        - react-i18next@13.5.0
        - react-icons@4.12.0
      - bump:
        - @mui/icons-material@5.14.19
        - @mui/material@5.14.19
        - axios@1.6.2
        - framer-motion@10.16.9
        - react-use@17.4.1
      - dev:
        - upgrade: tsup@8.0.1
        - update:
          - @octokit/types@12.3.0
          - @testing-library/react@14.1.2
          - @types/node@20.10.1
          - eslint@8.54.0
          - typescript@5.3.2
        - bump:
          - @testing-library/jest-dom@6.1.5
          - @types/autosuggest-highlight@3.2.3
          - @types/file-saver@2.0.7
          - @types/jest@29.5.10
          - @types/lodash@4.14.202
          - typedoc@0.25.4

## 3.0.0

### Major Changes

#### from alpha.1

- [e2bb42f6dd25dba2a25d76b52ed7825fe97f450c] Add branch name to resource object (if it is a repository)
- [57cd8147dba0d02ab09beb2cc117cb8d93f157f6] stop publishing umd bundle (vanila JS) and use TSUP for compile ts lib
  - BREAKING CHANGE: 🧨 Affect those using UMD bundles. Let me know if you want it back.

### Patch Changes

#### from alpha.5

- [65b5292c4c7a68bcbd9e7e88fdf631eba364c14e] change source name when switching providers
- [37e9e57a9f83dc721021a53aedbc5f477e6b0050] providers: catch error before prevent initialize providers

#### from alpha.4

- [3ce461faae5a998fa451361ae06acfc9316b54da] save document: pass `raw_url` to the response

#### from alpha.3

- [ec1371fbcaf88fc3249b80a8fc87641133bba0e4] Save document: add `url` and `content` to the response

#### from alpha.2

- [994effa1a4c3138f15626b0753f640dd738cb55c] Save document: add `url` and `content` to the response

#### from alpha.1

- [61035b9a844138a74b64c514b9f7cea047a41aef] Rename `Resource.ownertype` to `Resource.ownerType`
  - BREAKING CHANGE: 🧨 Property name changed.

### Maintenance

#### from alpha.1

- [1645fab8afa79ba4d3f74c2f350ad3d7e96202e0] remove docs (not useful)
- [6a67252c92703ef7392985ede70b27eca3d3189b] DOCS: simplify import statements
- [6a9a5901a56d27932f6e6380ca9753b80772d09a] update dependencies
  - core:
    - bump:
      - @mui/base@5.0.0-beta.22
      - @mui/icons-material@5.14.16
      - @mui/lab@5.0.0-alpha.151
      - @mui/material@5.14.16
      - dexie-react-hooks@1.17
  - dev:
    - remove webpack
    - add:
      - @octokit/types@12.1.1
      - jest@29.7.0
      - ts-node@10.9.1
      - typdoc@0.25.3
    - bump:
      - @types/jest@29.5.7
      - @types/node@10.8.10

## 3.0.0-alpha.5

### Patch Changes

- [65b5292c4c7a68bcbd9e7e88fdf631eba364c14e] change source name when switching providers
- [37e9e57a9f83dc721021a53aedbc5f477e6b0050] providers: catch error before prevent initialize providers

## 3.0.0-alpha.4

### Patch Changes

- [3ce461faae5a998fa451361ae06acfc9316b54da] save document: pass `raw_url` to the response

- \_\_

## 3.0.0-alpha.3

### Patch Changes

- [ec1371fbcaf88fc3249b80a8fc87641133bba0e4] Save document: add `url` and `content` to the response

## 3.0.0-alpha.2

### Patch Changes

- [994effa1a4c3138f15626b0753f640dd738cb55c] Save document: add `url` and `content` to the response

## 3.0.0-alpha.1

### Major Changes

- [e2bb42f6dd25dba2a25d76b52ed7825fe97f450c] Add branch name to resource object (if it is a repository)
- [57cd8147dba0d02ab09beb2cc117cb8d93f157f6] stop publishing umd bundle (vanila JS) and use TSUP for compile ts lib
  - BREAKING CHANGE: 🧨 Affect those using UMD bundles. Let me know if you want it back.

### Patch Changes

- [61035b9a844138a74b64c514b9f7cea047a41aef] Rename `Resource.ownertype` to `Resource.ownerType`
  - BREAKING CHANGE: 🧨 Property name changed.

### Maintenance

- [1645fab8afa79ba4d3f74c2f350ad3d7e96202e0] remove docs (not useful)
- [6a67252c92703ef7392985ede70b27eca3d3189b] DOCS: simplify import statements
- [6a9a5901a56d27932f6e6380ca9753b80772d09a] update dependencies
  - core:
    - bump:
      - @mui/base@5.0.0-beta.22
      - @mui/icons-material@5.14.16
      - @mui/lab@5.0.0-alpha.151
      - @mui/material@5.14.16
      - dexie-react-hooks@1.17
  - dev:
    - remove webpack
    - add:
      - @octokit/types@12.1.1
      - jest@29.7.0
      - ts-node@10.9.1
      - typdoc@0.25.3
    - bump:
      - @types/jest@29.5.7
      - @types/node@10.8.10

## 2.2.2

### Maintenance

- [914476873a830dc9fdcfa389ad71ea6c7417fb08] update dependencies
  - core:
    - update: axios@1.6.0
    - bump:
      - @mui/base@5.0.0-beta.21
      - @mui/icons-material@5.14.15
      - @mui/lab@5.0.0-alpha.150
      - @mui/material@5.14.15
  - dev:
    - bump:
      - @types/node@20.8.9
      - fake-indexeddb@5.0.1

## 2.2.1

### Patch Changes

- [d52d2b9fa42a04d2b61df30cee4507829c3bb1de] Saving: address issue preventing saving local files in the cloud

### Maintenance

- [ef61675d24511a912a8494cbec1909741523d6a4] linting

## 2.2.0

### Highlights

#### New source: URL

Users can now choose to load from a URL. The storage service will load the document and run validations (if provided). It returns the URL and the content.

#### Customizable header

It is possible to customize the dialog's header. Instead of `load` or `save` (default), you can pass any string.

#### Compatible with NextJS

Storage service will check if it is running on the server or in the browser before accessing the local storage. The storage services try to match user preferences (language and theme) by checking for properties saved on the local storage.

### Minor Changes

- [285644dfe7525b985673be41c305df875d9dad52] Add property to change the dialog header
- [4c8b0ee85b43f2bce50d4f8d3b2c6898d4670bce] Add support to load a file from a URL

### Patch Changes

- [8afcc1c1c36d985485da4cb49d2c16df8af47c60] Add compatibility with nextJS ['use client']
  - Test if the code is running on the browser before accessing the local storage
- [4b38a9f0444ea11464ace94a7d1541a6f18b454d] Fix the provider’s initialization

### Performance

- [72892c9983772375ea09d072b301beae4a9e687a] avoid rerenders
- [f01b306421172582da74fdf37b5921389c8298d1] improve tree-shaking

### Tests

- [3d1fdc37cae1a07eaa97bfe433a07b76d608b66f] Update test
- [8f15dcbb41e51fb27d3f5341c50a4c065b72844f] Remove undocumented/invalid properties
- [2262ed9e706dacfe05ea6810acb521ce15c4cc06] bump @testing-library/jest-dom to 6.1.4
- [bb8c9b42f2d27c6eb374993f7e57eafd55db808b] update @testing-library/user-event to 14.5.1
- [f27dd7bed57d6d4a46b09b377b4901435cf1d904] fix bug: resolve a problem with 'act' from '@testing-library/react'
- [abf2a464e9076ca28c8ebf3c78fd03e9b1dfd16b] adjust test coverage threshold

### Maintenance

- Linting, formating, typing
  - [4891617bd2683e49094c7e23e72e85b508803d31]
  - [7b299cc5026af8f6415a394f7b72d5dc3502add0]
  - [d69a324d7525a02456d63365903c2f69cbbc7a82]
  - [d9019cf5d47c737fafe5327f2841055b7e8f1f4b]
  - [d295423c43ffffb7530d82e3bdfc19fb3f068227]
  - [d10ae910a1026d24e1f24ef2d94f612b3654f112]
  - [8cde0f1f836d56bab6f28ca5bfe03794d71509c6] [6fc6cad64b10976a5cb42bc24adc36d815fef4f6] prettier: remove config 'react/jsx-max-props-per-line'
- [c39ba386cdd9f1482d39e6e93f8c5989473937d3] update esbuild-loader to 4.0.2
- [f29ee9fa643af32e32bde70ff32372096928b7c1] centralize linting
- [8cde0f1f836d56bab6f28ca5bfe03794d71509c6] prettier: remove config 'react/jsx-max-props-per-line'
- [58887c9f1867f18bc8a8045c341e2887b7459604] add scripts to format with prettier
- [8a0513339e9ad6ca8ed64c85f0dd5f57b4d8a2c3] remove unnecessary files
- [a086c80a47e8945b8bd095daa10b4f9e0ee74894] centralize tsconfig
  - .prettierrc
  - changelog.config.js
- [7d6190f27fe92b6aa91059eafa38dddcc2f9d890] improve tsconfig: implicit import react
- [2a5ff2569b21c2c9f6405aceb703f63c949ff692] make ts more strict
- [9f2044185521e8acafd06acac1b57c31ff0a4b1c] Update documentation
- [686217e51d37010470d0f6fa30f4bc52a4ea6575] update dependencies
  - core:
    - update:
      - @mui/base@5.0.0-beta.20
      - @mui/lab@5.0.0-alpha.149
      - axios@1.5.1
      - framer-motion@10.16.4
      - i18next@23.6.0
      - mui-modal-provider@2.3.1
      - react-i18next@13.3.1
      - react-icons@4.11.0
    - bump:
      - @mui/icons-material@5.14.14
      - @mui/material@5.14.14
      - @octokit/rest@20.0.2
      - overmind-react@29.0.5
      - uuid@9.0.1
  - dev:
    - remove:
      - eslint-config-prettier
      - eslint-plugin-prettier
      - eslint-plugin-react
    - add:
      - @types/node@20.8.7
      - eslint@8.52.0
      - typescript@5.2.2
    - upgrade: fake-indexeddb@5.0.0
    - upgrade:
      - @jest/globals@29.7.0
      - jest-environment-jsdom@29.7.0
      - webpack@5.89.0
    - bump:
      - @types/autosuggest-highlight@3.2.2
      - @types/file-saver@2.0.6
      - @types/jest@29.5.6
      - @types/lodash@4.14.200
      - @types/mocha@10.0.3

## 2.2.0-alpah.1

Same as above (v.2.2.0)

## 2.1.3

### Patch Changes

- Dependencies
  - Update `@mui/base@5.0.0-beta.10` - use named exports [186051b81c72779828738e1974b8eecfb97a134a]
  - Update dependencies:
    - core:
    - upgrade: @octokit/rest@20.0.1 [8163db4085d81cdd62e9e43801ec47fb9e633033]
    - update:
      - @mui/icons-material@5.14.3 [8163db4085d81cdd62e9e43801ec47fb9e633033]
      - @mui/material@5.14.4 [5ffef89b1375e716112b3acb6e89eae935df9b4e]
      - framer-motion@10.15.1 [5ffef89b1375e716112b3acb6e89eae935df9b4e]
      - i18next@23.4.3 [5ffef89b1375e716112b3acb6e89eae935df9b4e]
    - bump:
      - @mui/base@5.0.0-beta.9 [8163db4085d81cdd62e9e43801ec47fb9e633033]
      - @mui/lab@5.0.0-alpha.139 [5ffef89b1375e716112b3acb6e89eae935df9b4e]
      - react-i18next@13.0.3 [8163db4085d81cdd62e9e43801ec47fb9e633033]
  - dev:
    - upgrade:
      - eslint-plugin-prettier@5.0.0 [8163db4085d81cdd62e9e43801ec47fb9e633033]
      - eslint-config-prettier@9.0.0 [5ffef89b1375e716112b3acb6e89eae935df9b4e]
    - update:
      - @testing-library/jest-dom@5.17.0 [8163db4085d81cdd62e9e43801ec47fb9e633033]
      - @typescript-eslint/eslint-plugin@6.3.0 [5ffef89b1375e716112b3acb6e89eae935df9b4e]
      - @typescript-eslint/parser@6.3.0 [5ffef89b1375e716112b3acb6e89eae935df9b4e]
      - esbuild-loader@3.1.0 [8163db4085d81cdd62e9e43801ec47fb9e633033]
      - eslint-config-prettier@8.10.0 [8163db4085d81cdd62e9e43801ec47fb9e633033]
      - eslint-plugin-react@7.33.1 [8163db4085d81cdd62e9e43801ec47fb9e633033]
    - bump: [8163db4085d81cdd62e9e43801ec47fb9e633033]
      - @jest/globals@29.6.2
      - @types/jest@29.5.3
      - @types/lodash@4.14.196
      - @types/testing-library__jest-dom@5.14.9
      - fake-indexeddb@4.0.2
      - jest-environment-jsdom@29.6.2
      - webpack@5.99.2

## 2.1.2

### Patch Changes

- Documentation: Fix typo [302740a414c9960920487012f88675f73b87a79b]
- Adjust typescript config [69f920960f425b133b291de41cffb9e1dc167244]
- Update Dependencies [edd0207dcb4f5f215d424258df7ee083f9db2e48]
  - core:
    - upgrade:
      - i18next@23.2.8
      - react-i18next@13.0.1
    - update:
      - @emotion/react@11.11.1
      - @emotion/styled@11.11.0
      - @mui/icons-material@5.13.7
      - @mui/material@5.13.7
      - axios@1.4.0
      - date-fns@2.30.0
      - react-icons@4.10.1
    - bump:
      - @mui/base@5.0.0-beta.6
      - @mui/lab@5.0.0-alpha.135
      - @octokit/rest@19.0.13
      - dexie@3.2.4
      - dexie-react-hook@1.1.6
      - framer-motion@10.12.18
      - overmind@28.0.3
      - overmind-react@28.0.3
  - dev:
    - update:
      - @jest/globals@29.6.1
      - @typescript-eslint/eslint-plugin@5.61.0
      - @typescript-eslint/eslint-plugin@5.61.0
      - jest-environment-jsdom@29.6.1
      - webpack@5.88.1
    - bump:
      - @types/jest@29.5.1
      - @types/lodash@4.14.195
      - @types/testing-library__jest-dom@5.14.7
      - mini-css-extract-plugin@2.7.6
      - ts-jest@29.1.1

## 2.1.1

### Patch Changes

- dev: logproxies from overmind for better debug xp [86112a698e3f7fcc69f4082289a1c70273d2acfd]

## 2.1.0

### Minor Changes

- StorageDialog: Independently export StorageDialog (no default exports) [b8afe02caf76b79837f7c7a3049e0fad653d69a7]
  BREAKING CHANGE: 🧨 import from the internal path `@cwrc/leafwriter-storage-service` results
  in an independent exported component (no default export)

### Patch Changes

- Export types [02dab01336b4b96726e4a0796a0b25c9cf68dc0c]
- FixTests [aee5d9ffc95d7b6d681ace765ca3c6a82ca1f07c]

## 2.0.0

### Major Changes

- Headless: improve error handling [73c75ae66db24f53b58fbbf0e8f57c03bdff21e0]
  - BREAKING CHANGE: 🧨 headless now returs an Error object when there is an error

### Minor Changes

- Database
  - Export convient function to `clearCache` and `deleteDb` [c63e5f102bf8871814956a8f25dcf94be773941e]
- Icons
  - Support a vast collection of icons libraries [b5a93c73606dab39309c078b091573ea8deead7c]
- UI
  - Improve Header and Footer [39a24ed93c6f053e132c792f934a8ec15cee3ac8]

### Patch Changes

- State
  - Fix State: partially reset state after release file [fb2fb331ea86b81113d01ab48ff4b98906bcc913]
- Localization:
  - Tweak settings [cb0aaf03ce5a284532380fc8df1248f451f51a5e] [43b1b44a8b1b20db0be1b78ff8134bf1abea3781]
- Dialog:
  - Rename 'Message' as 'Body' [5ccffc43d11fbfe109260c0df6277a0155951875]
- Organization
  - Split Upload panel into small components [594d65604767a285692269c44ad26b04fd6c8997]
- Improve types [0cf1bb970015ce224142c3bd6e8350bfb36fe9d8]
- Improve tests [42432586476f795c48ea1a86167f4c27fb959a77]
- Improve import @mui dependencies [132abf208a5201930692b39fb7d9b2fcb88b7eff]
- Update dependencies [e93abe44c9f046915c27acf055077868ad2d194a]
  - core:
    - add: react-icons@4.8.0
    - update:
      - @mui/material@5.12.1
      - framer-motion@10.12.2
    - bump:
    - @mui/base@5.0.0-alpha.126
    - @mui/lab@5.0.0-alpha.127
    - axios@1.3.5
  - dev
    - update:
      - @typescript-eslint/eslint-plugin@5.59.0
      - @typescript-eslint/parser@5.59.0
      - webpack@5.79.0
    - bump @types/lodash@4.14.194

## 1.4.0

### New Features

#### Github

Load and save files large than 1MB

#### Public Repositories

Add a badge indicating the user has write permission. The badge only shows up when browsing someone else’s repository. You can see it while you browse another user or an organization repositories, and on the path (breadcrumbs) when navigating inside it.

The storage output (resource) now contains a new property, `writePermission` (boolean), indicating if the user has permission to write on the repository to which the resource belongs.

Change the way we store public repositories, from the `local storage` to `indexedDB`. IndexedDB has more storage space and it is more reliable for managing data.

#### Language

Add language as an optional property to settings. Now we can explicitly tell the storage service in which language it should operate. By default, it will first try to get the language on local storage (il18next) or fall back to en-CA. Supported languages so far: `en-CA` and `fr-CA`. Check the documentation for more details.

### Minor Changes

- Settings
  - Add language as an optional setting. [af63bd90f401c52ad0d9024d66bfa97d12eb4dd0]
    - These changes also refactor how to get language from the local storage
- Github
  - Load files large than 1mb [5f238d5b6588875b5f0c84acf1778e59f98a1a93] (closes #109)
- Public Repositories:
  - Add a badge indicating the user has written permission [41914a402f00cf2ab72fca6c735e33f6922b1c50] (closes #47)
  - Add `writePermission` property for repositories owned by another user. [573ce4bceed860e794ddaea763bcdc17b55ba678]
  - Move from the `local storage` to `indexedDB` [8f3f278351824deb4d715e189e0ce6df8f759edd]
    - This change improves how we manage public repositories accessed by the user.
    - It also makes some adjustments to the layout and UX.
- Headless Functions
  - Add localization [52e2d4ef142d602b1acdaa5509583b4103f2193b]
    - Caution: This is a SOFT BREAKING CHANGE: 🧨 Error from headless function now returns an object with a type error and a message.

### Patch Changes

- Sidebar:
  - Layout adjustments [7ce2ecd39d3727b817a217f593d312f32474737b]
- Preferred Storage:
  - Improve retrieve preferred storage from local storage [19ebd8b56eb94867e5950a0d4069a565cddffa7d]
- Public Repositories:
  - Change icons and add tooltip for repos shared with the logged user [f1548458a8442419f4cf12b8bd5949f3cfd5eadd]
  - Debounce rapid clicks on the same user/org [d4a39ed8b55588fc5854f17d3e0ea6db23801735]
  - Add scroll when the number of public repos overflows the space [d04daacc137360bb747839b2c78f24840ecd7910]
- File Collection:
  - Add ability to collapse details [6ecaf27afce386f6036d5f69eb591226e132b1c0]
- Types:
  - Add types. [819bbd13facd761ab304d58964e1a3537a785758]
  - Export Validate function Type from StorageDialog [333163bcbf21bfcdeeb1a80306b475dc8452a9f3]
- Localization
  - Add localization [819bbd13facd761ab304d58964e1a3537a785758]
  - Organize localization [bd4660e6e1c3af309ffa4358abd024f98e7b7981]
- GitHub
  - Regression:
    - Fix save non-existing (create) files [24a1615fc9779572bb287daf72d954e895e041db]
- Miscellaneous:
  - Reorganize folder structure. [819bbd13facd761ab304d58964e1a3537a785758]
- Update Dependencies:

  - core: [c250d6e77f3857bb4d53945764c1aedbb52e97db]
    - update:
      - framer-motion@10.10.0
      - mdi-material-ui@7.7.0
    - bump up:
      - @mui/base@5.0.0-alpha.124
      - @mui/icons-material@5.11.16
      - @mui/lab@5.0.0-alpha.125
      - @mui/material@5.11.16
      - i18next@22.4.14
  - dev:
    - add misssing:n [c250d6e77f3857bb4d53945764c1aedbb52e97db]
      - @jest/globals@29.5.0
      - eslint-plugin-prettier@4.2.1
    - update:
      - @types/jest@29.5.0 [3749999e007cca54a5dee54f9547a80bb0793671]
      - @typescript-eslint/eslint-plugin@5.57.1 [c250d6e77f3857bb4d53945764c1aedbb52e97db]
      - @typescript-eslint/parser@5.57.1 [c250d6e77f3857bb4d53945764c1aedbb52e97db]
      - eslint-config-prettier@8.8.0 [3749999e007cca54a5dee54f9547a80bb0793671]
      - ts-jest@29.1.0 [c250d6e77f3857bb4d53945764c1aedbb52e97db]
      - webpack@5.77.0 [c250d6e77f3857bb4d53945764c1aedbb52e97db]
    - bump up:
      - mini-css-extract-plugin@2.7.5 webpack@5.76.3 [3749999e007cca54a5dee54f9547a80bb0793671]
      - @types/lodash@4.14.192 [c250d6e77f3857bb4d53945764c1aedbb52e97db]

  ### Tests

  - Refactoring [767dfaeb8657620cf7fca0652c3c7b0977001128]

## 1.3.9

### Patch Changes

- Fix EsbuildPlugin minify config [fa93406fa8f2e2a45ca9faa8782b3e5ef3f997d5]
- Update dependencies [5561796d145ead66dce292cd17625618bafdad87]
  - core:
    - update: framer-motion@10.3.2
    - bump up:
      - @mui/base@5.0.0-alpha.121
      - @mui/lab@5.0.0-alpha.123
      - @mui/material@5.11.13
  - dev:
    - bump up:
      - @types/jest@29.4.4
      - webpack@7.76.2

## 1.3.8

### Patch Changes

- Update @mui/base components [1519cdba0d884cf6ecc4b03731a3386ca04cd0a2]
- Add / remove types [3e66a0ac99d3bf439aabecf15734ec4d326e89df]
- Tighten test threshold [e637910f5fa8f826aa1d4d216e7e0e0f6890c3b1]
- Add missing dependency: uuid@9.0.0 [0a1455d54a73db80f770994bfc98cf2ffa0d68aa]
- Update dependencies [d427322c0eab43b6d24c53d4471c448689d4ce2e]
  - core:
    - upgrade: framer-motion@10.2.4
    - update: react-i18next@12.2.0
    - bump up:
      - @emotion/react@11.10.6
      - @emotion/styled@11.10.6
      - @mui/icons-material@5.11.11
      - @mui/lab@5.0.0-alpha.122
      - @mui/material@5.11.12
      - axios@1.3.4
      - i18next@22.4.11
  - dev:
    - upgrade: @testing-library/react@14.0.0
    - update:
      - @typescript-eslint/eslint-plugin@5.54.1
      - @typescript-eslint/parser@5.54.1
      - eslint-config-prettier@8.7.0
      - jest-environment-jsdom@29.5.0
      - mini-css-extract-plugin@2.7.3
      - webpack@5.76.1

## 1.3.7

### Patch Changes

- webpack update esbuild configurations [0328c61a031157df29b09ab28c5c2d5f85d4e865]
- update dependencies [a625b9eb8fad4f88e45b4d529d7566f511e77134]
  - core:
    - bump up:
      - @mui/base@5.0.0-alpha.118
      - @mui/icons-material@5.11.9
      - @mui/lab@5.0.0-alpha.120
      - @mui/material@5.11.9
      - axios@1.3.3
      - framer-motion@9.0.3
      - react-i18next@12.1.5
    - dev:
      - upgrade: esbuild@3.0.1
      - update:
        - @typescript-eslint/eslint-plugin@5.52.0
        - @typescript-eslint/parser@5.52.0
        - jest-environment-jsdom@29.4.3

## 1.3.6

### Patch Changes

- fallback cloud provider when resource without storage provider is loaded [f964fafd175f22806cd5c60d085c91220b90f278]
- update dependencies [36b447243b5ea3a5fd57ff50a9d7017f239c943c]:
  - core:
    - upgrade: framer-motion@9.0.0
    - update:
      - @mui/icons-material@5.11.0
      - @mui/material@5.11.7
      - axios@1.3.0
      - i18next@22.4.9
      - mui-modal-provider@2.2.0
      - react-i18next@12.1.4
    - bump up:
      - @mui/base@5.0.0-alpha.116
      - @mui/lab@5.0.0-alpha.118
      - @octokit/rest@19.0.7
  - dev:
    - update:
      - @types/jest@29.4.0
      - @typescript-eslint/eslint-plugin@5.50.0
      - @typescript-eslint/parser@5.50.0
      - esbuild-loader@2.21.0
      - eslint-config-prettier@8.6.0
      - eslint-plugin-react@7.32.2
      - jest-environment-jsdom@29.4.1
    - bump up:
      - mini-css-extract-plugin@2.7.2
      - ts-jest@29.0.5

## 1.3.5

### Patch

- Expose the Validate type [8e74f5f71502734cf2ae94eaa2e6bb2c9e8e0740]
- Rename types [b05274cacac55c683f40ca10dbc5d4b57a785510]
- Update dependencies [7907888909f6635d682b79e2ac15eb9fcb57e341]
  - core:
    - upgrade: axios@1.2.0
    - bump up:
      - @mui/base@5.0.0-alpha.108
      - @mui/icons-material@5.10.16
      - @mui/lab@5.0.0-alpha.110
      - @mui/material@5.10.16
  - dev:
    - update:
      - @typescript-eslint/eslint-plugin@5.45.0
      - @typescript-eslint/parser@5.45.0
      - mini-css-extract-plugin@2.7.1
    - bump up:
      - @types/lodash@4.14.191
      - @types/mocha@10.0.1
      - eslint-plugin-react@7.31.11

## 1.3.4

### Patch Changes

- Reset: prevent removing prefer provider, list of providers, and public repo when reseting the dialog [a5906fd5aa05a16fedc201e1f01d8709974cf88f]
- update dependencies [7aa3526562ac49cbb866406ccd36480dca923646]:
  - core:
    - bump up:
    - @mui/base@5.0.0-alpha.106
    - @mui/icons-material@5.10.14
    - @mui/lab@5.0.0-alpha.108
    - @mui/material@5.10.14
    - framer-motion@7.6.7
    - i18next@22.0.5
- dev:
  - update:
    - @typescript-eslint/eslint-plugin@5.43.0
    - @typescript-eslint/parser@5.43.0
  - bump up:
    - @types/jest@29.2.3
    - @types/lodash@4.14.189

## 1.3.3

### Patch Changes

- Rollback dependency: axios@0.27.2

## 1.3.2

### Patch Changes

- i18next type: wrap translation as a string [36700d9a6556ac0a0cfad6efd2922cc1a885260b]
- Update dependencies [ae75abb0cf5063315e3e5e4da05fa99df18cbbbc]:
  - core:
    - upgrade:
      - axios@1.1.3
      - i18next@22.0.4
      - react-i18next@12.0.0
    - update:
      - framer-motion@7.6.5
      - mdi-material-ui@7.6.0
    - bump up:
      - @emotion/react@11.10.5
      - @emotion/styled@11.10.5
      - @mui/base@5.0.0-alpha.105
      - @mui/lab@5.0.0-alpha.107
      - @mui/material@5.10.13
      - loglevel@1.8.1
    - dev:
      - update:
        - @types/jest@29.2.2
        - @typescript-eslint/eslint-plugin@5.42.1
        - @typescript-eslint/parser@5.42.1
        - jest-environment-jsdom@28.3.1
        - webpack@5.75.0
      - bump up:
        - @types/lodash@4.14.188

## 1.3.1

### New Feature

- Localization: Add French translation (fr-CA) [57a311013cbe4839d551395c896adb0a387b3e65]

### Patch

- Update dependencies [a90cdb81dea87bf66f2083045ba48f79d517c85a]:
  - core:
    - bump up:
      - @octokit/rest@19.0.5
  - dev:
    - update:
      - jest-environment-jsdom@29.2.0

## 1.3.0

### Breaking Changes

- Capture http error 409 (conflict) while saving [5e3de6a757823062ca8a5f0ea3a986b767f98aa8]

This error is generated by GitHub (and possibly by GitLab) when the request for saving (overwriting) a file does not have a matching hash. It was also caused by a delay on the GitHub side in updating the document hash, which resulted in not saving the file. This commit also adds translations and adjusts tests accordingly.

BREAKING: 🧨 As a consequence of this change, results from the headless modulo changed a bit. The object returned there is an error changed from `{error: string}` to `{type: string; message: string}`

### Patch

- Update dependencies [8634f35f9471cc51818f03b85d5331feb3fc3169]
  - core:
    - update:
      - framer-motion@7.5.3
      - i18next@21.10.0
    - bump up:
      - @mui/base@5.0.0-alpha.101
      - @mui/icons-material@5.10.9
      - @mui/lab@5.0.0-alpha.103
      - @mui/material@5.10.9
      - react-dropzone@14.2.3
  - dev:
    - upgrade:
      - @types/mocha@10.0.0 [3ac416495ee4ad3c5e776354414f6eb5f2c3724f]
    - update:
      - @types/jest@29.1.2
      - @typescript-eslint/eslint-plugin@5.40.0
      - @typescript-eslint/parser@5.40.0
      - jest-environment-jsdom@29.1.2
    - bump up:
      - @types/lodash@4.14.186
      - eslint-plugin-react@7.31.10
      - ts-jest@29.0.3

## 1.2.0

### Minor Changes

- Rework message dialogs to make it more coherent with the UI/UX [462c17c74a11d57bc4ed26d19455728d0fc44dfa]

Messages Dialogs are now centralized in a manager and UX is more aligned to the core LEAF-Writer. More localization were added.

### Patch

- Localization: define namespace: leafwriter-storage-service [e0127d599c0660fcd703727e0ae5515fc5b5e9dc]
- Reorganize folder structure [b4bd86fa60a80057a3eb0d49c4594745c02da99a]
- Update Dependencies [6c5de2829246bfcc0fd54d5260e55168fb9eb0c2]:
  - core:
    - add:
      - mui-modal-provider@2.1.0
    - bump up:
      - @mui/base@5.0.0-alpha.98
      - @mui/icons-material@5.10.6
      - @mui/lab@5.0.0-alpha.100
      - framer-motion@7.3.6
      - i18next@21.9.2
  - dev:
    - bump up:
      - @typescript-eslint/eslint-plugin@5.38.0
      - @typescript-eslint/parser@5.38.0

## 1.1.2

### Patch Changes

- Update dependencies [401d3af7e4cadba4700ee0073e0733bc5e908951]:
  - core:
    - update:
      - @mui/icons-material@5.10.3
      - framer-motion@7.3.5
    - bump up:
      - @emotion/react@11.10.4
      - @emotion/styled@11.10.4
      - @mui/base@5.0.0-alpha.97
      - @mui/lab@5.0.0-alpha.99
      - @mui/material@5.10.5
      - @octokit/rest@19.0.4
      - date-fns@2.29.3
      - i18next@21.9.1
      - overmind@28.0.2
      - overmind-react@29.0.2
      - react-i18next@ 11.18.6
  - dev:
    - upgrade:
      - @types/jest@29.0.3
      - jest-environment-jsdom@29.0.3
      - ts-jest@29.0.1
    - update:
      - @testing-library/react@13.4.0
      - @typescript-eslint/eslint-plugin@5.37.0
      - @typescript-eslint/parser@5.37.0
      - esbuild-loader@2.20.0
      - eslint-plugin-react@7.31.9

## 1.1.1

### Patch Changes

- Fix typo on the main menu: Respositories -> Repositories [33cb0950f4bf2c7cbbd7df4e839da98070f70c85]

## 1.1.0

### Minor Changes

[1e4b13b]

- [UX] Replace message dialog for alert dialog to improve UX
  - Message dialog still exists but it is used only when the user need to do some action like delete a file.
- [Progress] Replace linear for circular progress bar while loading the UI
- [Perf] Simplify code logic
- [Chore] Rename types folder
- [Dependencies] update

[a885b2f]

- [feat] Add a log manager to improve dev/prod versions
  - We use loglevel to control when to output logs (no more dirty logs on production version).
- [fix] Mimetype on upload panel: Remove `text/md`, `text/tsv`, and `text/xml`.
  - This is a minor break, but I will treat it as a fix, since this is not widelly publi yet. MDN recommends `application/xml` instead of `text/xml`.
- [fix] Drag'drop height
- [test] Add a bunch of new tests
- [docs] Update and fix typos

### Patch Changes

[924a08a]

- **Update to Reac 18**
- [dependencies] Update dependencies
- [tests] Patch tests for React 18
