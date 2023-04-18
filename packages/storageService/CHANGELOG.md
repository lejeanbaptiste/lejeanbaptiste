# CHANGELOG

## 2.1.0

### Minor Changes

- StorageFialog: Independently export StorageDialog (no default exports) [b8afe02caf76b79837f7c7a3049e0fad653d69a7]
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
