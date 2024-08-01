# CHANGELOG

## 3.6.0

### Major Changes

- [3b28cdb69d6631c726bdc996d7ad33ef9cb7978f] localization:
  - Add support to Portuguese, Spanish, Romanian, and German.
  - Rename localization namespace
  
### Minor Changes

- [cef0247e85badc3401aa5e320a22fe435fb65c78] Add `id` property to leafwriter class

### Patch Changes

- [85e852012ba5d04300e7c8f5a0dd3545ea144f79] Improv support to css (replace some less files)
- [7dd4e8f419f2f165ce2729283a1db9da4053597f] Update dependencies
  - core:
    - add:
      - nanoid: 5.0.7
      - react-i18next@15.0.0
    - upgrade: uuid@10.0.0
    - update:
      - @emotion/react@11.13.0
      - @emotion/styled@11.13.0
      - @fortawesome/fontawesome-free@6.6.0
      - @mui/icons-material@5.16.6
      - @mui/material@5.16.6
      - axios@1.7.2
      - chroma-js@2.6.0
      - framer-motion@11.3.21
      - i18next@23.12.2
      - jotai@2.9.1
      - jotai-devtools@0.10.0
      - mdi-material-ui@7.9.1
      - monaco-editor@0.50.0
      - react@18.3.1
      - react-dom@18.3.1
      - react-icons@5.2.1
      - react-intersection-observer@9.13.0
      - react-virtuoso@4.9.0
      - zod@3.23.8
    - bump:
      - @cwrc/leafwriter-validator@4.4.1
      - dexie@4.0.8
      - formik@2.4.6
      - jquery-ui1.13.3
      - rdflib@2.2.35
      - react-resizable-panels@2.0.22
      - react-use@17.5.1
  - dev:
    - upgrade:
      - @types/node@22.0.2
      - @types/uuid@10.0.0
      - css-loader@7.1.2
    - update:
      - @types/react-dom@18.3.0
      - esbuild-loader@4.2.2
      - mini-css-extract-plugin@2.9.0
      - typescript@5.5.4
      - webpack@5.93.0
    - bump:
      - @types/jquery@3.5.30
      - @types/jqueryui@1.12.23

## 3.5.0

### Minor Changes

- [9b5c66259478211e61401658569db14e4584a945] Authority: Add support to GND: The Gemeinsame Normdatei (translated as Integrated Authority File, also known as the Universal Authority File) or GND (#189). Thanks Jacob @jgb-hda
- [9ff0a719ce6cf97590c45dfbda025e609ad861c9] Raw xml editor: add well-formness validator and warn user if xml invalid before update (#212)
- [dd2a89b6419befeafb288c9ac01a428ea83cf5d1] Explose public method `isValid` (#204)
- [b946af926d481030b7511c601682aca88e65bf71] Schema: Drop support: TeiCorpus, TeiDrama, TeiMS, and TeiSpeech (# 183)
- [754ce95ed1935e5a8f0596585fb403034af736d6] Schema: add supoprt for 'TEI Simple Print' and jTei (# 183)

### Patch Changes

- [422bdd779578b9e0c5b03c3b37406ae755ad56f8] Better error handling when saving. Show error message to user (#135 #200)
- [4820bb45aa23d883dbf5483a9ce44c93c0862977] Reset and hide invalid stats when document becomes valid again (#211) - Thanks Jacob B (@jgb-hda)
- [9053ed6b50a43d1756584bce48ba08a351dc67fd] Add condition ot to autosave if content is reloaded from code view changes (#203) - Thanks Jacob B (@jgb-hda)
- [0c43cee8ce6da76aac0e116361cc6c4b62691f93] Edit raw: fix behaviour preventing update document/markup panel when editing on code view (#203) - Thanks Jacob B (@jgb-hda)
- [b601a6ab7ab2ac569fe2898ac9f24733512e4da7] Entity panel: fix filter preventing organization to be displayed (#210)
- [a562736cb65172636c5b166da399848e0628759e] Fix bug preventing tag attributes and data to be stored correctly after update (#190)
- [e9cb4a18817a2f8ec74683fa12f5ceccb40d631c] Fix issue preventing logout when leafwriterValidator is not prevent on the window context (#205)
- [4ee0a8ee6c86177c680a0e564fcd863eafe9b7a8] Conversion prompt messages: fix bug preventing message's content to show up
- [1f44be58e0a22ed998a3d3733a0b68d92482bfb2] Add schema: fix issue preventing user to edit the fields (#176 #174) - Thanks Jacob B (@jgb-hda)
- [b6e8df0caa5cd38994bdf855fc96cdbe22dc6c7c] dialogs: Change `markups` to `attributes` (#181)
- Improve typing [e59fb474b2778aac898148c53187120bfba02eda] [9d1d10f2e1b079f2c10f75d53adca6c4d0901b4e] [e6492690c6f52de9e1cbc43217e68a7365913740]
- Updated dependencies
  - @cwrc/leafwriter-validator@4.4.0

### Chore

- [b739bfe6e5c4d8d1f54101cedfe4fa6c1db1023d] Rename file
- [d1fdd9f6929bf9924a8fe994edfcfd9d54aaebf5] Avoid path alias
- update dependencies
  - core:
    - add: jotai-devtools@0.8.0 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
    - upgrade:
      - dexie@4.0.4 [520e2a300dac03cf8d0cc51cc2af6a77c21667c4]
      - framer-motion@11.0.27 [48acf449732cf06f5f52df23abc9d43709d757e8]
      - react-i18next@13.1.0 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - react-icons@5.0.1 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - react-resizable-panels@2.0.13 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - wikibase-sdk@10.0.2 [36e55b9071e75b89f0373ef16a38c71a316924f1]
    - update:
      - @mui/icons-material@5.15.15 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - @mui/material@5.15.15 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - classnames@2.5.1 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - i18next@23.10.1 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - jotai@2.8.0 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - i18next@23.11.1 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - loglevel@1.9.1 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - mdi-material-ui@7.8.0 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - monaco-editor@0.47.0 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - mui-modal-provider@2.4.2 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - react-intersection-observer@9.8.2 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - react-use@17.5.0 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - react-virtuoso@4.7.8 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - zod-formik-adapter@1.3.0 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
    - bump:
      - @emotion/react@11.11.4 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - @emotion/styled@11.11.5 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - @fortawesome/fontawesome-free@6.5.2 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - @fontsource/lato@5.0.20 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - axios@1.6.8 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - dexie@3.27 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - openseadragon@4.1.1 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - rdflib@2.2.34 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - react-resizable-panels@2.0.16 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - tinymce@5.10.9 [36e55b9071e75b89f0373ef16a38c71a316924f1]
  - dev:
    - add: css-loader@6.11.0 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
    - upgrade:
      - copy-webpack-plugin@12.0.2 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - webpackbar @6.0.1 [36e55b9071e75b89f0373ef16a38c71a316924f1]
    - update:
      - @types/luxon@3.4.2 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - @types/node@20.12.7 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - esbuild-loader@4.1.0 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - eslint@8.57.0 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - mini-css-extract-plugin@2.8.1 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - typescript@5.4.3 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - typescript-plugin-css-modules@5.1.0 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - webpack@5.91.0 [36e55b9071e75b89f0373ef16a38c71a316924f1]
    - bump:
      - @types/chroma-js@2.4.4 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - @types/react-dom@18.2.24 [9431deef11d6a496ae46004d5650e27f58f2bd4d]
      - @types/jqueryui@1.12.22 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - @types/react-dom@18.2.22 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - @types/uuid@9.0.8 [36e55b9071e75b89f0373ef16a38c71a316924f1]
      - ypescript@5.4.5 [48acf449732cf06f5f52df23abc9d43709d757e8]

## 3.4.0

### Highlights

#### Clear schema

There is now an option to clear cache (indexedDB) on the settings panel.

### Minor Changes

- [7dc69966efa1ddfcdbeb69707ac4d1485f407ccf] Add option to clear cache (indexedDB) on the settings panel
- [a90891751d05665b4b282410e89cc8b84b2086ca] Add static method to clear indexedDB tables

### Patch Changes

- [155f5aed7377e95c4486f945601adcf91dfc6258] Settings: issue preventing toggling entity types
- [c8f81c70276879aef7198a3235d96e4d24a1a0cd] Fix typing
- Format
  - [9dfe9909aed8fcb3e7b8c553cac5b91c504e5ce3] [1b7e3bb7731e76b57933e4d8691826c79199c7f5]
- Maintenance
  - [69d0c936151f96bc7a56c8a915bd7842463aa2a3] Coalesce tsconfig in the package
  - [cbb7cfbc69d8f2c4d68cff9e2ca51f2b6377ac5f] Update dependencies
    - core:
      - upgrade:
        - @dnd-kit/modifiers@7.0.0
        - @dnd-kit/sortable@8.0.0 |
      - update:
        - @cwrc/leafwriter-validator@4.3.0
        - @dnd-kit/core@6.1.0
        - fortawesome/fontawesome-free@6.5.1
        - i18next@23.7.7
        - jotai@2.6.0
        - react-i18next@13.5.0
        - react-icons@4.12.0
      - bump:
        - @dnd-kit/utilities@3.2.2
        - @mui/icons-material@5.14.19
        - @mui/material@5.14.19
        - axios@1.6.2
        - framer-motion@10.16.9
        - luxon@3.4.4
        - rdflib@3.2.33
        - react-intersection-observer@9.5.3
        - react-resizable-panels@0.0.63
        - react-use@17.4.1
        - wikibase-sdk@9.2.4
      - dev:
        - update:
          - @types/node@20.10.1
          - eslint@8.54.0
          - typescript@5.3.2
        - bump:
          - @types/chroma-js@2.4.3
          - @types/css@0.0.37
          - @types/fscreen@1.0.4
          - @types/jquery@3.5.29
          - @types/jqueryui@1.12.21
          - @types/js-cookie@3.0.6
          - @types/luxon@ 3.3.6
          - @types/openseadragon@3.0.10
          - @types/progressbar.js@1.1.7
          - @types/react-dom@18.2.17
          - @types/shelljs@0.8.15
          - @types/tinymce@4.6.9
          - @types/uuid@9.0.7

## 3.3.1

### Maintenance

- [a1d4ea3fafda6029a7bda21a7da73edc160be08f] remove docs (not useful)
- [d16863dccbd1f2b77edcc4a617d94b0ffd078902] release script: use js to avoid ts-node
- [ad2ff0bedd371b945c2a860e5a057de036eda4b9] remove babel config (unused)
- [e09779417b94f744e2726a58b444cf516dfc7168] tweak tsconfig
- [d013ef05803980ec974d6a324bd1dee8bfbceae5] remove build es6 (unused)
- [6362aa29ad276555345d2a40c351b927d33aaa18] update dependencies
  - core:
    - bump:
      - @mui/icons-material@5.14.16
      - @mui/material@5.14.16
      - dexie-react-hooks@1.1.7
  - dev: bump: @types/node@20.8.10

## 3.3.0

### Minor Changes

- [c67caa63a499c671dba873586248e72307a19771] no longer clean validator db

### Maintenance

- [c82d5e7c676abd2865de9ffc058ae28d7036bcc8] update dependencies
  - core:
    - update: axios@1.6.0
    - bump:
      - @mui/icons-material@5.14.15
      - @mui/material@5.14.15
  - dev: bump: @types/node@20.8.9

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter-validator@4.2.0

## 3.2.3

### Patch Changes

- [b4550aade219d929e9f1607c8c98dbbcdbdf8599] contextmenu: fix position

### Maintenance

- [a95c55cc6f2b83f03ddf17bd3836f048b9e5503a] update esbuild-loader to 4.0.2
- [c12961736495a0699c2bec970e8583f459e005fd] decentralize lint/format
- [4a455a5fca5776f2a43a3263671ddcf8ea7d29c6] add lint/format scripts
- Linting, formating, typing
  - [8f480019cde054a826fc3be2ba0248903d8680c4]
  - [10ecb962bf3ce9391a098ddeeddc0af9ba2a3833]
  - [1e09b594ce79ac6be3f15a77cbbb166ed55b804d]
  - [9d9bc873670137a9fbd6cc5822e1d5c0fb2836ca]
- [edf546a8282d56aa8c9558e2c6e7eda35d93276e] remove unnecessary files
  - changelog.config.js
  - issue_template.md
- [be37f8843591d408439c9d055b959d5ebe0112c4] centralize tsconfig
- [3160d7ca655707d433c5459227b976deb76c302b] improve tsconfig: implicit import react
- [94f3db63c8e583ecb44bacd31c900b0a8c957580] update documentation
- [ca1637f723b3f6704820b59d5e01b611b0cb741a] update dependencies
  - core:
    - update:
      - axios@1.5.1
      - framer-motion@10.16.4
      - i18next@23.6.0
      - jotai@2.5.0
      - monaco-editor@0.44.0
      - mui-modal-provider@2.3.1
      - react-i18next@13.3.1
      - react-icons@4.11.0
      - react-virtuoso@4.6.2
      - zod@3.22.4
    - bump:
      - @cwrc/leafwriter-validator@4.1.2
      - @fontsource/lato@5.0.17
      - @mui/icons-material@5.14.14
      - @mui/material@5.14.14
      - formik@2.4.5
      - jquery@3.7.1
      - luxon@3.4.3
      - overmind-react@29.0.5
      - progressbar.js@1.1.1
      - react-resizable-panels@0.0.55
      - uuid@9.0.1
      - wikibase-sdk@9.2.3
  - dev:
    - remove:
      - @typescript-eslint/eslint-plugin
      - @typescript-eslint/parser
      - eslint-config-prettier
      - eslint-plugin-prettier
      - eslint-plugin-react
      - husky
    - add:
      - eslint@8.52.0
      - typescript
      - typescript-plugin-css-modules
    - update: @types/node@20.8.7
      - bump:
        - @types/chroma-js@2.4.2
        - @types/css@0.0.35
        - @types/fscreen@1.0.3
        - @types/jquery@3.5.25
        - @types/jqueryui@1.12.19
        - @types/js-cookie@3.0.5
        - @types/luxon@3.3.3
        - @types/openseadragon@3.0.8
        - @types/progressbar.js@1.1.5
        - @types/react-dom@18.2.14
        - @types/tinymce@4.6.7
        - @types/uuid@9.0.6

## 3.2.2

### Patch Changes

- Panels
  - Fix panels display based on readonly mode [7d54717b739c6c35a9aff1e98d4a21da302096c8] [6d616d156c228a7bacbb659c2f12817cb4ef0440]
  - Raw xml
    - Change RDF link [23454b4c2cead2720b7d35c1e29efcd2672bfa55]
- Update dependencies [1cece2dd30bbff86750b6182ae764d65f196e24b]
  - core:
    - update:
      - framer-motion@10.15.1
      - jotai@2.3.1
      - luxon@3.4.0
    - bump:
      - @fontsource/lato@5.0.8
      - @mui/material@5.14.4
      - i18next@23.4.3
  - dev:
    - upgrade: eslint-config-prettier
    - update:
      - @typescript-eslint/eslint-plugin@6.3.0
      - @typescript-eslint/parser@6.3.0
    - bump: @types/node@20.4.9

## 3.2.1

### Patch Changes

- UI
  - Navigation scroll behaviour (elements scrollIntoView) [25cc98386950c2c8bcc94806bc1298b925c4443e](closes #157)
  - Sort person role by label (Alphabetically) [66d1bcb47bc07f49cc1d0dfcb817ac197f8c6528](closes #160)
- Formating [2084c44288dc16e88ca0b34aaf60b65bd7f1e547]
- Update dependencies [620a3077894271ab342cf1a7a13e6f80917e4603]
  - core:
    - update:
      - @mui/icons-material@5.14.3
      - @mui/material@5.14.3
      - i18next@23.4.1
      - monaco-editor@0.41.0
      - react-virtuoso@4.4.2
      - wikibase-sdk@9.2.2
    - bump:
      - @fontsource/lato@5.0.7
      - @fortawesome/fontawesome-free@6.4.2
      - formik@2.4.3 jotai@2.2.3
      - react-i18next@13.0.3
      - react-resizable-panels@0.0.54
  - dev:
    - upgrade:
      - @typescript-eslint/eslint-plugin@6.2.1
      - @typescript-eslint/parser@6.2.1
      - eslint-plugin-prettier@5.0.0
    - update:
      - esbuild-loader@3.1.0
      - eslint-config-prettier@8.10.0
      - eslint-plugin-react@7.33.1
      - monaco-editor-webpack-plugin@7.1.0
    - bump
      - @types/luxon@3.3.1
      - @types/node@20.4.7
      - webpack@5.88.2

## 3.2.0

### Minor Changes

- New Code/Raw XML/Selection Panel [e40e03ec6fff8a25fe1ff9d119df6f8a2c771a95]
  - Refactored in React. Same funcionality. Added localization and dark theme.

## 3.1.0

### Minor Changes

- Tags:
  - Add a tooltip (showing documentation) to the tag list (context menu, ribbon) (#146) [9109bc0e6fcd6dc6dffef9d63aaa464dbf5becc0]
  - Improve tag search. Search for both name (key) and full name (label) (#148) [e8eb9ce0dea5bbf3ffc612ad05a9c6c3ce8f3c05]
- Editor: Add popups to entities with links [a4f9a7be13c91a6f6667a5b8df9dea3038f9a9b9]

### Patch Changes

- IndexedDB: explicitly upgrade 'suspendedDocuments (#155) [ab845e4e0f8d54b6fc42fac6fd138ee2c3a4750d]
- Person dialog: Do not assume schema has documentation [3c14f3a0d274e828824b4f03bdba6331e71eb3e0]
- UI:
  - Raw Xml Panel: Prevent hiding button one small window (remove min-height) (#151) [f7c41fb30f0fd8a72ef491eacec25bb65e753dd2]
  - Privacy dialog: prevent dialog from being behind storage panel [a13bbc146d0498ec6d8420cdb16b4e7ec791b40b]
  - BottomBar (refactor): Re-export component [8596e653d140b587690a7f870a629b38d1fd36a2]
- Validator: import validator utilities direct from '/lib' [9fb0a037a3ee8957dee6f362ffe02444e2988905]
- Documentation: Explain how to use and integrate LEAF-Writer (#153) [c1eb26deb1a3845b908f82275f7a2f6b46d9d0f3]
- Chore:
  - Adjust typescript config [3615d4a03dcb79c90b8a8155dee0fb3bf84cac68]
  - Remove unused files [26044e84b5cd017764471b67dbc377e5c8e4b54f]
  - Adjust typescript config [5c26946c9a9fbfe3a5479f20ed11dbd3a1239c5d]
  - Replace some jquery functions [3bde766a086774860fcadbe221d1e300fa0c11e5]
- Webpack: add stream fallback [582a10854a2ad8fe4fe52a331b45d1811eb55164]
- Update Dependencies [ba3c04eff5eb07b058cbff9d817410d791872a62]:
  - core:
    - upgrade: - @fontsource/lato@5.0.4 - i18next@23.2.8 - monaco-editor@0.40.0 - react-i18next@13.0.1
      -update:
      @mui/icons-material@5.13.7 - @mui/material@5.13.7 - formik@2.4.2 - jotai@2.2.2 - jquery@3.7.0 - openseadragon@4.1.0 - react-icons@4.10.1 - react-intersection-observer@9.5.2
      -bump: - @cwrc/leafwriter-validator@4.1.1 - @emotion/react@11.1.1 - dexie@3.2.4 - dexie-react-hooks@1.1.6 - framer-motion@10.12.18 - overmind@28.0.3 - overmind-react29.0.3 - react-resizable-panels@0.0.53 - react-virtuoso@4.2.11 - wikibase-sdk@9.1.3
      -dev:
      -upgrade: @types/node@20.4.0
      -update: - @typescript-eslint/eslint-plugin@5.61.0 - @typescript-eslint/parser@5.61.0 - webpack@5.88.1
      -bump: - @types/jqueryui@1.12.17 - @types/openseadragon@3.0.6 - @types/uuid@9.0.2 - @types/react-dom@18.2.6 - mini-css-extract-plugin@2.7.6

## 3.0.1

### Patch Changes

- fix(core): 🐛 Raw xml panel: add type=button to a button element to avoid auto-submit behaviour [d64070c38f0160fa37c6e5708605778fec2819ac]
- Update dependencies [84b12fb229cbe031a3f743395f8beaf7266f1025]
  - core:
    - update:
      - @emotion/react@11.11.0
      - @emotion/styled@11.11.0
      - axios@1.4.0
      - jotai@2.1.0
      - monaco-editor@0.38.0
      - react-i18next@12.2.2
      - react-virtuoso@4.3.5
      - wikibase-sdk@9.1.1
    - bump:
      - @mui/material@5.12.3
      - framer-motion@10.12.8
      - i18next@22.4.15
      - js-cookie@3.0.5
      - react-i18next@12.2.2
      - react-resizable-panels@0.0.32
      - rxjs@7.8.1
  - dev:
    - update
      - @types/react-dom218.2.4
      - webpack@5.82.0
    - bump
      - @types/progressbar.js@1.1.3
      - @typescript-eslint/eslint-plugin@5.59.2
      - @typescript-eslint/parser@5.59.2

## 3.0.0

### Notable Changes

#### IndexedDB

LEAFWriter takes advantage of the browser's indexedDB to store and cache use preferences, settings, and internal states. More specifically, we have implemented 4 tables in this version:

- authorityServices: Stores user preferences related to entity lookups
- customSchemas: Stores user custom squemas
- doNotDisplayDialog: Stores user preferences (when the user does not want a particular dialog to display again)
- suspendedDocuments: Stores the current state right before the user scrape or use NERVE to enhance the document annotation. Because the process heavily modified the document, having the state of the document before the process starts allows the user to discard changes and go back to the previous state.

LEAF-Writer Validator now has a similar setup. It uses indexedDB to cache transformed XML schemas. With this change, LEAF-Writer does not need to cache it. It has direct access via indexedDB if need it.

All these come with a minor breaking change 🧨. The lookup service settings have been renamed as `authorityServices`, and their shape has changed. This affects how LEAF-Writer is instantiated.On the settings property, you should pass an array of authorities with an `id` and further configurations. for instance:

```ts
authorityServices: [
  { id: 'geonames', settings: { username: 'geonamesUsername' } },
  'lgpn',
  { id: 'wikidata', entities: { organization: false, title: false, thing: true }}
],
```

Check documentation for more.

### Major Changes

- Authority Service Preference [9dd3a58a2337af73b943d9e93ca87ca904e69f6b]
  - Move AuthorityServices preferences from localstorage to indexedDB. Refactor setup.
    - Reorganize the setup structure around AuthorityServices (previously LookupService). It reintegrates the code for the HTTP request (due to the small size). It also restructures the initial configuration for authority services.
  - BREAKING CHANGE: 🧨 Change the initial settings when LW is initialized. Check documentation.

### Minor Changes

- Update Validator [09326d0f66667230e37bc1d79646beefcef94118]
  - Adopt new API
  - No need to receive and cache scheme. The validator does it by itself using the browser indexedDB.
  - Add not about node module resolution [3095f7d4313b52f9fee7a806d8788a134b6e4bb7]
    - Package Exports are only available when TSconfig nodeModuleRosultuon is set to NODE16 or NODENEXT. But, this new configuration means a different setup to load dependencies, which might break other things. We should way a little longer to adopt the new setup
- Custom Schemas: Move custom schemas from localstorage to indexedDb [b5d7073d108b4cd73950179a87d5878ee14ca096]
- Show Dialgos Preferences: Move doNotShowDialog from localstorage to indexedDb [c9abe4340f6bb714f3e840185f8f24fc260b960c]
- DB: Expose convenient functions to clear cache and delete inxdedDB used by `leafwriter` [53c5d49e8eb64c2c6d0cc1c7351de12b061f6e64] [27995c1021b0fc222e524b2dad5897c434c4dddc]
- Icons: Add support for multiple icon libraries [7829f26c5eb21daf3232a1df7ef17e34723fc80b]

### Patch Changes

- Form Validation: Replace yup with zod [e91e73434c91341cfc957668a9d6589a7af1bc91]
- Simple Dialog: rename 'Message' as 'Body' [89a2143951e301ba2ceaad61dee1776e3c7f50de]
- Theme: Listen to event 'changeTheme' dispatched from other modules [1f3ef3863656065f1f871bb1a7ad6deccb2e0967]
- Localstorage: Integrate with internal localstorage API [5bda60827bcb51c1f72a87f68f26e22f9181ca2d]
- State:
  - Remove unnecessary conditions [f112e70406eefbb4c60bfdadde7a3a81833bef72]
  - Fix reset preferences: authority services [249d8bbb2003dcbcc20be25a386bdefcd588b8b0]
  - Improve reset state when LW is disposed of [5a7a3c1f91921db6539d4fde498836ab86fc0064]
- Fix bug on Chrome: not focusable element [249d8bbb2003dcbcc20be25a386bdefcd588b8b0]
  - Element with display 'none' and with a field with a required attr. May cause "An invalid form control with name=’x’ is not a focusable error". Solution (not really) from [here](https://www.geekinsta.com/how-to-fix-an-invalid-form-control-with-name-is-not-focusable/)
- DB: Correct name 'suspendedDocuments' [d6ce31d0b388ba59a6655d11e43fc66e5c05c201]
- Ribbon: remove uuid as an alternative to keys in a react array [d5b37828c5a797fe04ddfa33479c2f5fe4ddd905]
- Localization tweaks [5ad2b2e680a0d3572b50d9806f6c86ccdecb9645] [93a7ccd7fe943bd0a5967897b5b73f9dafe66483] [dc60383132213559a592486fef4a4c234f1195bd] [de781242f2f00af3e5dbf5905bf4c8a20efa687a] [2e186bdac2c577ef3a32a4550ab21303d6abd302] [85524dc57cdd22913c0cb8e56a9ef4f1169b08b2]
- Remove logs [9db77e7382d46bc425da370e56e851ca9e41754e] [80f85c5b05bfc83ced95f3ddd924aee49ba2699c]
- RAW XML: Independent export of the editor [e0611ab8c1310d973ca584c5b3c09d25c8e84476]
- Updated dependencies
- Update dependencies [04cc4456ecf2aaea08d4feaf9cce8ca9ce502cbd]
  - core:
    - add: react-icons@4.8.0
    - upgrade: @cwrc/leafwriter-validator@4.1.0 [abfc13b1280f984b845974708107b5a4dd093cd5]
    - update:
      - @mui/material@12.1 axios@1.3.5
      - framer-motion@10.12.2
    - bump
      - jotai@2.0.4
      - monaco-editor@0.37.1
      - rdflib@2.2.32
      - react-resizable-panels@0.0.40
      - react-virtuoso@4.2.1
  - dev:
    - update:
      - @typescript-eslint/eslint-plugin@5.59.0
      - @typescript-eslint/parser@5.59.0
      - webpack@5.79.0
    - bump
      - @types/shelljs@0.8.12
      - typescript-plugin-css-modules@5.0.1

## 2.7.4

### Patch Changes

- ContextMenu:
  - Add autofocus to search tags [46b68723e54aed8286eef99dd4aac42398d3e827]
- Suspended documents
  - Improve how suspended documents are stored [428c68faa3fb677ff9a74f61835570bf9941664b]
- CSS:
  - Fix first-letter selector [6b5c8f1b803ca0dd62256560cf6c8e72a1475f05]
  - Add CssBaseline as a way to solve css clash with the underlying webpage [4d9715b432f14c49e9d430ae7a09878802d69449]
  - date picker:
    - Attempt to block overwrite from bellow [ef75de61afae681ff78661d90ec71186c5e0d6ed]
  - Clean [4c2679663bd96216fa348b3178b333607a4ed8a0]
- Types:
  - Move type assertion to a dedicated module [df77eac53eae5c24c69554a18564c005a63f75a8]
  - Improve localStorage API to receive generic Type [7004c303e65596b188caaa48f2122f4a23955410]
- Localization
  - Create an instance, instead of using the library directly [9b4c5ac224e13a40bbca40aaaf8514a5d588c0b6]
- Update dependencies [5e8eb21604c9d84cf25a34f34f1d608ca7b1e038]:
  - core:
    - add missing: @dnd-kit/utilities@3.2.1
    - upgrade: notistack@3.0.1
    - update:
      - @fortawesome/fontawesome-free@6.4.0
      - framer-motion@10.10.0
      - mdi-material-ui@7.7.0
      - monaco-editor@0.37.0
      - react-virtuoso@4.2.0
    - bump up:
      - @mui/icons-material@5.11.16
      - @mui/material@5.11.16
      - i18next@22.4.14 react-resizable-panels@0.0.39
  - dev:
    - add missing:
      - copy-webpack-plugin@11.0.0
      - eslint-plugin-prettier@4.2.1
    - update:
      - @types/luxon@3.3.0
      - @typescript-eslint/eslint-plugin@5.57.1
      - @typescript-eslint/parser@5.57.1
      - webpack@5.77.0
    - bump up: @types/node@18.15.11

## 2.7.3

### Patch Changes

- Document: Accept undefined URL properties (template, samples, uploaded documents) [ce7882cc126c2dac3878a2caa619101dc3046ede]

## 2.7.2

### Patch Changes

- Layout manager:
  - Handle hide panels (null) when opened in readonly mode [8b084d51e1266ef7bc4929b31fe08fae828744e4]
  - Make TOC the default panel on the left sidebar [b012c6df8e86f242769e97920e8552ae8d1b13b3]
- Markup Panel:
  - Replace 'inherit' with the palette primary color when entities are not found [c08331e3dcb43def034c0467715a5f35d1fb8cff]
- Context Menu:
  - Prevent displaying textNodes as sugestions until we have better support [2b66d7dc2fc9fc6eca19357aedf33c6230562247]
  - Hidde the options to show textNodes until we have better support [384cebeefdc46f9e3bbf23c53f1dedd7f332988c]
    Edit Source Dialog:
  - Accept the property type header to update just this section of the document [8c629a0ec7ce00dad76c9750ae5d5d1ead1f1c4a] [2ea6417f8943bb0b1d1b1b890373f8a9957996d9]

## 2.7.1

### Patch Changes

- Markup panel:
  - Block context menu on root and restrict on the header [cb09a97361a6cab76dadf4178ae3640fd552fca9]
  - Improve types [009eeabe006df410941dd613fffe5d2cb163075b]
- Clean logs [bbf3544af6a2c45c26bb4c09cfcd67c0409d0df0]

## 2.7.0

### What's new?

#### Validation

leafwriter-validator 2.0 introduced new features and fixed some bugs.

##### Improved speculative validation

Fix a bug preventing speculative validation on different intended actions (add before, add after, add around, add inside, add a tag, change a tag). This caused the list of possible tags to include some elements that would invalidate the document as valid. With this fix, you will see more strict behaviour.

##### Return all possible tags with a flag indicating if they are invalid

Instead of having either the possible or valid tags, the validator returns all the possible tags and flags them as either valid or invalid. This feature makes it easier to filter invalid tags based on user intention. Previously, LEAF-Writer only used valid tags as suggestions for a given context. Now it shows all the possible tags, visually flagging the invalid ones and letting the user show/hide them. To provide a concrete example, the tags `biblFull` and `biblStruct` never showed up as an option to add a tag before a `p`. Even though they are possible in `p`, they have specific requirements (e.g. `biblFull` requires `biblStruct` as a child). Now, LEAF-Writer shows all possible tags and allows users to add and, consequently, invalidate their document, which they would subsequently be warned by the validator and have a chance to fix the problem or save it as is.

#### The `textNode` is also available

Previous behaviour filtered `textNode` out of the possible tags (since it is not a tag). Now, the `textNode` returns as possible (and speculatively validated) together with the other tags. The `textNode` is identified with the type `text`.

#### Context Menu

The Context Menu was revamped to use the new features introduced by leafwriter-validator 2.0.

The context menu will now show all the possible tags for context, including both valid and invalid. There is a visual distinction using icons and gray-out colours. There is a toggle to show/hide invalid tags. Note that the new list of possible tags includes the textNode. However, there has yet to be any support to add them to the document. Use this feature with caution.

There is support to access a textNode context menu in the markup panel. There are options to copy the content of a textNode, paste content into it, remove the content, or remove the textNode altogether. Note: some textNode actions are not fully implemented, notably adding a tag before, after, and around. Use this feature with caution.

This version also fixed a few bug fixes, including one related to the nested menus.

#### Markup Panel

We improve support for textNodes. TextNodes are now clickable, which means they can be used for navigation and highlighting. It is also possible to access additional functionalities in the context menu. Some actions (like multi-selection and drag and drop) still need to be fully implemented. By default, textNodes are not hidden. You can show/hide textNodes in the contextMenu or the settings panel.

### Minor Changes

- Events:
  - Add new event listeners to set the editor as 'dirty' [a8c0b57c7c7c6b5d1bd7cb0dfed2cc596704d6e5]
    - New events: 'tagAdded', 'tagEdited', 'tagRemoved', 'tagContentsRemoved', and 'contentPasted'
- ContextMenu:
  - Revamp context menu: use new validator API, allow for textNode, toggle invalid, fix bugs [a11fa6bbe4f18c5c3687525701162d6f215e8f07]
    - Complete Refactoring:
      - Use new validator API to show possible tags (valid and invalid).
      - Add toggle to show/hide invalid tags. Add an option to show textNodes in the markup panel.
      - Add support for textNode context.
      - Add copy, paste, and remove actions for textNode.
      - Fix nested menus.
      - Note: some textNode actions still need to be completely implemented (add a tag before, after, and around).
- Markup Panel
  - Improve support for textNodes: [987611e5d719d4fadd478a0662c0f615ff25d480]
    - allow selection, multi-selection, drag and drop, access contextMenu
    - This change also rename the component from 'strucutreTree' to 'markup'
    - Note: these features are still in beta. Use with caution.

### Patch Changes

- Localization:
  - Give better support for translation [090023a9f4c9c8a64e90a90b3943af12a94608d2]
    - This is a partial fix. i18next config needs to be improved for better support in LW Commons
- Icons
  - Adjust the size (book) [897b36be9cc48b1aba44410e524982080d41389d]
  - Add two new icons [107d55bd87702186555fad4715f8b0279a354396]
- Toc: Rename component as TocPanel [94ac61158287e37f3f109e7128297795ea7c5b11]
- Utilities: Split functions into specialized modules (string, dom, etc...) [674f06a4068df337698e313f8d718cb046b4c4f1]
- Types:
  - Coalesce the 'entitytype' type in a single place [9f3878f8a24b0fe2ac0ec845bb7d1b1b1169cf14]
  - Move 'writer' declaration to the root [ed453cd2fdbafce0d963a4c309164d0e39c6adcc]
  - Use Typescript strict mode [ceec3203985657d2bcd96ddad7d014ca48ebd61a]
- LocalStorage: Handle error when transforming string into json [3fdc407ac3dd3ce7e2e8f1cd5473b51fc94eb395]
- LookUps: Better error handling for geonames when three is no username [479d5b7b26eee63a950b776939a1f6a0f1c514b1]
- Ribbon: Allocate buttons into groups [0f9936aabeee69ac3f5c35e27652619170101677]
- StyledTooltip: fix title capitalization [766ff7e77efcf70a115ebe37f0eb952bd9913be0]
- Schemas: add 'label' to the empty schema object [d63d75b65bbbdcfafba5c23d99ddd20348689ebf]
- Validator: Update @cwrc/leafwriter-validator@2.0.0 and make changes to the API calls [9a63b84d9828d7ba8a30244ad17ec9c477ca258f]
- Settings:
  - Remove the toggle for multi-selection in the markup panel. This feature is now always on. [93f503640ad3b84216c271ed0d27871f59049ec6]
    - Add a note to textNode (in beta)
- Update dependencies [6dabde7e3ab22a2c261a569f5c10300c14c93c4d]
  - core:
    - remove:
      - prismjs [a7211bce3742028ce1a80cea86acff9fde9c1b87]
      - prims-themes [a7211bce3742028ce1a80cea86acff9fde9c1b87]
      - wikidata-sdk [c4bf63ce95b9879a451fcee0f74c8eaee8ee4d21]
    - add: wikibase-sdk [c4bf63ce95b9879a451fcee0f74c8eaee8ee4d21]
    - upgrade: @cwrc/leafwriter-validator@2.0.0 [9a63b84d9828d7ba8a30244ad17ec9c477ca258f]
    - update: framer-motion@10.9.1
    - bump up:
      - @mui/material@5.11.14
      - i18next@22.4.13
      - rdflib@2.2.31
      - react-resizable-panels@0.0.37
  - dev:
    - remove: @types/prismjs [a7211bce3742028ce1a80cea86acff9fde9c1b87]
    - upgrade: typescript-plugin-css-modules@5.0.0
    - update:
      - @typescript-eslint/eslint-plugin@5.56.0
      - @typescript-eslint/parser@5.56.0
      - eslint-config-prettier@8.8.0
    - bump up:
      - @types/node@18.15.10 [4e620d6e7baea69c992a16d6c1194599b1e48ca7]
      - mini-css-extract-plugin@2.7.5
      - webpack@5.76.3

## 2.6.1

### Patch Changes

- TOC: heading identation and expansion [e68ee1428ebdd7f740053778964670d236468440]
- Improve logging [e97e225c1925652e2087caab1d9d9ab5d79ebaaa]
- Markup Panel:
  - Reduce initial open level [cf4bd71c7b3596ba363dc909d7f925eb8cf94aa8]
  - Reduce tooltip delay to 1200 ms [9afbba8fc0f69cdabfb537e664a6285badae1c98]
  - Allow drag only of selecting whole tag [5b5ab5c190543be650ccc4c972bcab147dd342c2]
- Clean, rename var, remove comments [1944d8a8445d4b67ac6f0fc2bd2b95bc93ad8589]
- Tests change lib url [32738d54791006181ff1bd2ce34f664921af700c]
- Fix EsbuildPlugin minify config [498eeb5e029761ad0a395fb0674966a9a88adae3]
- Update dependencies [62b87f77a1b62a535fee0d03f7cb8c726158f004]
  - core:
    - update: framer-motion@10.3.2
    - bump up: @mui/material@5.11.13
  - dev:
    - bump up:
      - @types/node@18.15.3
      - webpack@5.76.2
- Updated dependencies
- @cwrc/leafwriter-validator@1.2.4

## 2.6.0

## New Features

### New Markup Panel

Redesign and reimplement the Structure Tree [04ae91440652f56556d62171123346ca7d4fe549]
Implemented React. Dark theme included. Uses `Jotai` for internal context state.
Features:

- Expand / collapse the tree
- Show / hide text nodes.
- Select the whole tag or content only.
- Context Menu
- Multi-selection
  - Constraints: adjacent tags from the same parent container
  - Allows for merging tags with the same tag name.
  - Allows adding a tag around selected tags.
- Drag and drop (experimental)
  - Reorder and reorganize the document by moving tags around.
- Hidden when LEAF-Writer is in read-only mode.

### New Table of Content panel

A tree-like panel showing only the document's heading [99274ef1aa8ac409626817a2fe3d1a2248dbc322]
Derived from the new Structure Tree. It is the default panel in the left sidebar now.

### redesign Settings Dialog

Due to the increase of options in this dialog, a menu was introduced. The idea is to accommodate more options in the future and avoid occlusion. [e79ff7f2ff3b448299221a1d0201cbdd7fc9d72b]

### Headings in Schema Mapptins

Add the `headings` property to schema mappings as a way to identify headings tags [dc3d551fcf79f4b50a847afbc992fc3591293007]
Replace a hardcoded identifier for the headings when creating a table of contents,

### Patch Changes

- Add a rudimentary test to check if LW commonJS lib is loading [6ee0f58dd1e0c405edc95c4e171f2091ec8e52f6]
- Add / remove types [1bad6fe21528c84500cd7b869a3b304410d0705a] [fb6a89281b921060b6532d39f1fd84cc46137af0] [e3336623365ea9f0921b58420d0b4a98e7293102]
- Simplify css properties in mui components [a02ecf799352fc8fc5986e17ffa24df0e39224e0] [98d7592e7b269f0976b3c10c297a4f41fb28630b]
- Get component (Stack from @mui/material) from the right lib [88ce110dab424e27062b32c107546aecd3c20462]
- Dialogs: export type SimpleDialogMessageProps [9f2c36fded24ea260eecd5325bb63aa03868f54b]
- Types: Add a check to narrow NODE by type (ELEMENT | NODE) [b52127935867e11a7dac57c2049291d14f630887]
- Formatting and removing commented code / styles [72386c49d3be411fb8682dc55c704b5e990edfd7] [05110e03112904a39eab808b7eee6d2fba4ecd10]
- Isolate and coalesce ToggleButtonGroup component [f880a18691ec71f5b9757f2c09137a464a55de7b]
- Ribbon: add transition [d09fcdf449ec62b41bc4f2f7b19b30f11a743e28]
- Coalesce icons into a centralized place with a single getIcon API. The list of icons is a Record now, which means that it is typed and easy to select an icon when using getIcon [9879d7f48029239d0b5483dd1fadc149ddb623f4]
- Entities: getTitleFromEntity: trimEnd optional. Remove added ellipsis [573556112ad9c3bb5a6658fc36955c529e01890a]
- Tagger: remove global ignore types. add types and keep ignore types for legacy code [201f0a579edb4a8d2935a475b3a8e5a35dca834f]
- Utilities: add smooth scroll in select elements out of view in the editor [9b093ece107c568d4f3e5de74e26eb50a3c6a136]
- UI: Rename function `showEntities` -> `setShowEntities` [a9f8158d98a92de30b685a5cfe1905ea3fc0fd87]
- ContextMenu: reorganize files, replace animation, add types, use new icon API. Drop `react-transition-group` in favour of `framer-motion`, which is used elsewhere in the project [659c1f22c7ff825ec2b818129d85e808755e06cb]
- Add localization [92b94ebfb3b8647f7dea7d0bfaf5ab0daf010765]
- WIP: Redesign layout panels. Not available yet. [ddc9d52767a6b06b501026b9358b78a0795d882c]
- Update dependencies [1da6aeb2e1e78a460356b4ffaa5acfa9d824d19e]:
  - core:
    - remove unused: @mui/lab
    - upgrade: framer-motion@10.2.4
    - update:
      - luxon@3.3.0
      - monaco-editor@0.36.1
      - react-i18next@12.2.0
    - bump up:
      - @dnd-kit/core@6.0.8
      - @emotion/react@11.10.6
      - @emotion/styled@11.10.6
      - @mui/icons-material@5.11.11
      - @mui/material@5.11.12
      - axios@1.3.4
      - dexie-react-hooks@1.1.3
      - i18next@22.4.11
      - jquery@3.6.4
      - rdflib@2.2.30
      - react-intersection-observer@9.4.3
      - yup@1.0.2
  - dev
    - update:
      - @types/chroma-js@2.4.0
      - @types/js-cookie@3.0.3
      - @types/node@18.15.0
      - @typescript-eslint/eslint-plugin@5.54.1
      - @typescript-eslint/parser@5.54.1
      - eslint-config-prettier@8.7.0
      - webpack@5.76.1
    - bump up:
      - @types/js-cookie@3.0.3
      - @types/uuid@9.0.1
      - mini-css-extract-plugin@2.7.3

## 2.5.0

## Features

### Edit header

Bring back the ability to edit header. Right click on `teiHeader` from the `Mark up` panel to open a xml editor with only the elements in the document header. [1ce5e5d011ca9212a9b24f60f34416ac736e062d]

### New Ribbon

TinyMCE standard toolbar was limitting our ability to control how the ribbon show up and which buttons show it display.
We have now a new custom toolbar build with React that we can customize in several ways (including using color coding to match entities)
[f3f2f8ba7ed228d66549d2fec014acb6d993f1a6]

### Readonly Mode

We are bringing back the readonly mode. In this mode a number of funcitonalites are blocked or hidden to prevent changes in the document. [ef5add578623a93154a8ee7dcbf9320e4e7a4529].

Notably changes are:

- Editor: prevent typing or editing
- Ribbon: Hide all buttons related to insertion of tags/entities. Only show UI options.
- Settings: Only show UI options
- Bottom Bar: Hide editor optons (edito mode, annotatopn mode, schema)
- Panels: Hide `Validation` and `Raw XML Viewer` Panels. The `Mark Up` panel doubles as `Table of Contents`, showing only the document heading.

To make LEAF-Write readonly, pass the property `readonly: true` when initiating the editor. Example:

```js
leafWriter.init({
  document: {
   ...
  },
  settings: {
    ...
    readonly: true,
  },
  user: ...,
});
```

## Minor Pathces

- Rename `selection panel` to `raw xml` [ecd40aa576066b8121be7c287228f44d57e10abd]
- Add the 'thing' entity to the theme [65517eecd244e74a22adbb772873722452ce9f94]
- Add Styled Tooltip component as an idenpendent component [9d337e5c7c472971f56e184f46aa22ae834c4e65]
- Prevent change content when pressing meta keys (cmd, ctrl, alt, etc) [87736230ca6d529cc58e7734afd2b3d7199d1019]
- rename property `isDirty` to `contentHasChanged` [020a3230d86f1c12fee6888da69cc0ca72db8ed7]
- webpack update esbuild configurations [a8c8e8f09307c9911bd73dba15d1baa90e4b89ab]
- update dependencies [dd45e21657479cd5ff576953da523c937bcf1287]
  - core:
    - remove: react-router-dom
    - upgrade: yup@1.0.0
    - update:
      - @fortawesome/fontawesome-free@6.3.0
      - monaco-editor@0.35.0
    - bump up:
      - @mui/icons-material@5.11.9
      - @mui/lab@5.0.0-alpha.120
      - @mui/material@5.11.9
      - axios@1.3.3
      - comlink@4.4.1
      - framer-motion@9.0.3
      - rdflib@2.2.26
      - react-i18next@12.1.5
      - react-intersection-observer@9.4.2
    - dev:
      - add: @types/tinymce@4.6.5
      - upgrade: esbuild-loader"@3.0.1
      - update:
        - @types/node@18.13.0
        - @typescript-eslint/eslint-plugin@5.52.0
        - @typescript-eslint/parser@5.52.0
      - bump up:
        - @types/chroma-js@2.1.5
        - @types/openseadragon@3.0.5
        - @types/react-dom@18.0.11

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter-validator@1.2.3

## 2.4.0

### Feature

#### Role in named-entity Person (#99)

- Tag edit: get person roles from schema and allow custom value via input [c76d2c821f4213f36416ec8d413590a3767594df]

The attribute roles in the Person entity only shows up if the schema defines it. Accodingly, the if the schema define the possible values, the list will populate the dripdown menu where users can pick the value they desire. If the schema does not provide the list, we use a hardcoded list with ~250 itms.

Future versions should consider remove the harcoded list and have a lookup service to get the list from specific sauthorities, sucha as CWRC.

#### Suspend "onChange" event when scraping tags (#105)

- Add state to suspend autosave in specific circunstances, like when using entity scraping [805c64a8db7ac12a153211ad7b8f77fb1fc4ea4c]
- autosave: prevent LW to send hasContentChange events when doing some operations [2b1f94066798e2ef9e7162d878442980d6abf7f8]
- use indexDB to save a suspeded state of the document [d467095cc8cd89e7a6e65cde8fb792ea9102bc4d]

Some tasks in LEAF-Writer requires the manipualtion of the document as a way to make things visible for user. When scraping entities from tags, LW momentaneously introduce attributes to these tags to allow user to accept / reject theses tags as entities. Theses changes would normally be broadcast to LW host, which would use as a sign that the document has change and thus triggering actions such as "autosave". This would cause the document to save the changes and add all the tags as entities without the user awareness. To prevent this to happen, critical tasks like "scrape" should suspend the document changes broadcast until the user finish the task. To make things even safer, before suspending the changes broadcast event, LW caches the document's current state on the browser indexedDB. If there is content request during the suspension (for saving, for instance), LW will hand the cached version. Once the the task is completed, the cache is emptied.

### Patch

- Schema: update orlando schema / css [16c8ad2470d34ed2c8d71b2774f6384270a773d5]
- Parser to get schema/css uri from xml document. Allows for values with single and double quotes [3cf2f24d028afe402e8a8ec582cecf810a5dad7f]
- Prevent open context menu from teiHeader [dae8728e122196988104dd3003f2733b9651a2ee]
- Dialogs: fix color-scheme when theme is dark [ca4d23e2b8b50e65b0626652837d2d33ec4f9132]
- entity color: fix citation color [85230b283306da8afa617906856ef06bd9381623]
- Dark-theme on PB tag [a7fd0bce4398d763944843a80139c30b9f29558d]
- jquery event [0f816a7eb72d785da8686b932b035caaacb686ca]
- onLoad event should keep sending updates when other files gets loaded in the same session [d459f07da9a46737b4fffa28a27f6db9676f9ba5]
- schema mapper: consider entry withut uri (non-named entity) [6367bdc813edc0f68d6e0f8a63dee97b1baf518f]
- Add non-named entity to entity scraper (#103) [fe8eeb4f01bc5c0ee063aa6bbecdda99f74ee89c]
- Settings: allows anonymous user to access the settings panel (#102) [d5fac7724a91ad394bd1006dda45cea27bfb607d]
- rename fontSize variable [600d8ee0bec46963377c876f1d4b7c9c0636453c]
- update dependencies [de1ae1d31a9c7b0a35629ac68819b928b0734ed2] [6e9db30ee0d2bcfa81fde98be9ff65cee2251134]
  - core:
    - add:
      - dexie@3.2.3
      - dexie-react-hooks@1.1.1
    - upgrade:
      - framer-motion@9.0.0
      - openseadragon@4.0.0
      - update:
        - @mui/icons-material@5.11.0
        - @mui/material@5.11.7
        - axios@1.3.0
        - comlink@4.4.0
        - i18next@22.4.9
        - luxon@3.2.1
        - mui-modal-provider@2.2.0
        - react-i18next@12.1.4
        - react-router-dom@6.8.4
        - rxjs@7.8.0
      - bump up:
        - @dnd-kit/core@6.0.7
        - @dnd-kit/modifiers@6.0.1
        - @dnd-kit/sortable@7.0.2
        - @mui/lab@5.0.0-alpha.118
        - jquery@3.6.3
        - jstree@3.3.14
        - rdflib@2.2.25
        - wikidata-sdk@8.1.1
    - dev:
      - update:
        - @types/luxon@3.2.0
        - @typescript-eslint/eslint-plugin@5.50.0
        - @typescript-eslint/parser@5.50.0
        - esbuild-loader@2.21.0
        - eslint-config-prettier@8.6.0
        - eslint-plugin-react@7.32.2
      - bump up:
        - @types/jquery@3.5.16
        - @types/node@18.11.18
        - @types/react-dom@18.0.10
        - husky@8.0.3
        - mini-css-extract-plugin@2.7.2

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter-validator@1.2.2

## 2.3.1

### Patch

- User props: remove avatar_url & nick. Add uri. [7b9e9c69587e125b46f829689ab7e3421ae2967d]
- Rename types [a6affdbdc116b3682ffe4202f0a5e0d00d43f8e1]
- Update dependencies [91b130e51a7d4fde5fa86e987115f088d120d344]:

  - core:
    - update: axios@1.2.0
    - bump up:
      - @fortawesome/fontawesome-free@6.2.1
      - @mui/icons-material@5.10.16
      - @mui/lab@5.0.0-alpha.110
      - @mui/material@5.10.16
      - framer-motion@7.6.18
      - i18next@22.0.6
      - luxon@3.1.1
      - react-intersection-observer@9.4.1
      - react-router-dom@6.4.4
  - dev:
    - upgrade: @types/uuid@9.0.0
    - update:
      - @typescript-eslint/eslint-plugin@5.45.0
      - @typescript-eslint/parser@5.45.0
      - mini-css-extract-plugin@2.7.1
    - bump up:
      - @types/node@18.11.10
      - @types/react-dom@18.0.9
      - eslint-plugin-react@7.21.11

- Updated dependencies
  - @cwrc/leafwriter-validator@1.2.1

## 2.3.0

### Minor Changes

- Ingest optional list of supported schemas. [e1d0cc32c2b9a2d4caa7f8069821423ed6cc0905]
  - Remove default support to the following schems: `CWRC TEI Lite`, `CWRC Entry`, `REED`, and `Orlando Events`.
  - Note: This is a BREAKING CHANGE 🧨 without a major release.

### Documentation

- Add instructions to README file: How to install, Initialize, and Configure. [e84e91ea258884efa236aaed6f27906dc758c563]

### Patch Changes

- Parser to get schema and css url from xml headers: it was matching `https` but negleting `http` [182d7e238614812a158c26e38f0e77f587b59fde]
- Ribbon: `view raw XML` and `validate` should open the respective panels on the sidebar [bd20bd98b94289a64abcf5f71fd6442dc229cd26]
- Disable and mark jspopup as deprecated [ab4f97b42ad0f35ddd72418e7b672b159f0d517f]
- Update dependencies [ef6f53c4201353b5123d15e21fc1fa18be613385]:
  - core:
    - upgrade:
      - axios@1.1.3
      - i18next@22.0.4
      - react-i18next@12.0.0
    - update:
      - framer-motion@7.6.5
      - luxon@3.1.0
      - mdi-material-ui@7.6.0
      - wikidata-sdk@8.1.0
    - bump up:
      - @emotion/react@11.10.5
      - @emotion/styled@11.10.5
      - @mui/lab@5.0.0-alpha.107
      - @mui/material@5.10.13
      - loglevel@1.8.1
      - monaco-editor@0.34.1
      - notistack@1.0.8
      - rdflib@2.2.21
      - react-router-dom@6.4.3
  - dev:
    - update:
      - @types/luxon@3.1.0
      - @typescript-eslint/eslint-plugin@5.42.1
      - @typescript-eslint/parser@5.42.1
      - webpack@5.75.0
    - bump up:
      - @types/node@18.11.9
      - @types/react-dom@18.0.8
      - husky@8.0.2

## 2.2.0

### New Features

#### LEAF-Writer will create an anonymous user if a user is not provided

LEAF-Writer now fully supports an anonymous user. The only required attribute to initialize the editor is the content itself.

#### Localization: Add French translation (fr-CA)

[eab31a3b0aab176d782ed1ea58fc444928b61756]

This is a work in progress. Only a small portion of the terms have multilingual support

### Minor

- Rename public API `getDocumentSnapshot` to `getDocumentScreenshot`. Add flexibility, default options, fallback, and types. [e1d0cc32c2b9a2d4caa7f8069821423ed6cc0905]
  - Note: This is a BREAKING CHANGE 🧨 without a major release.

### Patch

- Fix a bug in which discarded observers keep listening the editor [db4c0bf7b7812a132f3ad72c07ec8ef558cbeae9]
- Update dependencies [93ccf067ae2269320519d974daa6260160d48076]:
  - dev:
    - update:
      - types/node@18.11.0

## 2.1.0

### Minor Changes

- Add TextEmphasis component: add more flexibility to customize and highlight text message[079c71c33db3db5113a0654d84d8397be58607ee]

- Add autosave toggle to settings panel [221ce25a13683e770821ae5b6fb3f9a6e1fc6dcf]

If the system embedding LEAF-writer has an autosaved mechanism (as LEAF-Writer Commons now has), the user can toggle the service on/off from the settings panel.

- Add Ability to create a document screenshot [aa077328fe5f6740a97fe44f67936943d8ba9be5]

This service API converts the document page into an image. It is helpful to create thumbnails.

### Patch

- Fix: Avoid circular updates on `isDirty`. Limit to fire only if the document changes from `no changes` to `has changed` [6a7a1952dd8a05941c5416ca24f8373871a08a7a] [c7d35c945f7cb6d5623bdae60e18e69273095269]
- Fix: Initialize overmind mutations listeners in every instance creation [0a2ea30ff61f208d034576e7bab5aa8d42cfe125]
- Fix: Avoid adding schema custom twice [20d45ef4678f005e6702e0ae2ff953e4519d5c4f]

- Update dependencies [6679ee190cb095ae598000fdf97011711208d4e8]
  - core:
    - update:
      - framer-motion@7.5.3
      - i18next@21.10.0
    - bump up:
      - @fontsource/lato@4.5.10
      - @mui/icons-material@5.10.9
      - @mui/lab@5.0.0-alpha.103
      - @mui/material@5.10.9
      - luxon@3.0.4
      - react-router-dom@6.4.2
      - rxjs@7.5.7
    - dev:
      - update:
        - @types/node@18.8.4
        - @typescript-eslint/eslint-plugin@5.40.0
        - @typescript-eslint/parser@5.40.0
      - bump up:
        - @types/openseadragon@3.0.4
        - eslint-plugin-react@7.31.10

## 2.0.1

### Patch Changes

- CRITICAL UPDATE: Use local version of 'jquery-layout3' [2d1e2757f65ba50a4e573474edaef86e1e39fdd1]

A deep dependency of 'jquery-layout3' is broken. This lib is very old and it is unlikelly to be updated. Need to move away from jquery an continue transition to React.

## 2.0.0

### Major Changes

- Improve the way LEAF-Writer is instantiated and controlled from outside [c20058585c50117dacb513e22d302ae42e1479a6]

BREAKING CHANGE: 🧨 New instance of LEAF-Writer only takes the HTML container where it will be attached. To actually render it, you must use the method `init` passing the document and other options

- Dialogs: Move more dialogs to the new dialog manager[6c9e63e2a0d48880a34c68a2b3bd4c3b1fcfa0ee]

More Dialogs are now centralized in a manager making UX more coherent.

### Patch

- Messages: add hint to how change editor mode [b743598e05adf9b714c9d5120fdfee80c50d345b]
- fix typo in a type [b743598e05adf9b714c9d5120fdfee80c50d345b]
- validation: update number of error to 0 when document is valid [c2607a26cb7ba1379a0bfdd23cb97681a6b6f7b2]
- organize folder and paths [4f54c167e5615b9d12985e413ddf7beec57104fb]
- certify the document comes from https when loading directly from url [01e805f188dedaeb34194dbdcde49a79fb5ebc27]
- Strucure tree: reduce interference with top menu on commons [b339d0f77d151a2c76daba753866f63bd2c60c9b]
- Update Dependencies [55f12f4806025fab0d8c39b716ead1d84c870168]:

  - core:
    - lock: tinymce@5.10.5
    - bump up:
      - @mui/icons-material@5.10.6
      - @mui/lab@5.0.0-alpha.100
      - @mui/material@5.10.6
      - framer-motion@7.3.6
      - i18next@21.9.2
      - react-router-dom@6.4.1
      - wikidata-sdk@8.0.5

  ## 1.8.0

### Features

### Better schema processing and UX for not supported schemas

Rework the logic of check, loading, and processing document schemas. The system is more strict and comprehensive now.

#### 1. Check root element

It will fail on any document wihout a suported root element:

- For TEI: `TEI`, `teiCorpus`
- For TEILite: : `TEI`, `teiCorpus`
- For Orlando: `ENTRY`, `EVENT`, `BIOGRAPHY`, `WRITING`
- For CWRCEntry: `CWRC`

#### 2. Check if the document has a schema attached to its metatag

If it does not, the system will promt the user to select a supported schema or add a custom one.
The document's root element is used to determine the mappings.

#### 3. Check if the schema is supported

If it is not, the system will promt the user to select a supported schema or add a custom one.
The document's root element is used to determine the mappings.

#### 4. Check if the schema loads

If it does not, the system will promt the user to select a supported schema or add a custom one.
The document's root element is used to determine the mappings.

### Add/edit/remove custom schemas on localstorage

Much improved system to add, edit, and remove custom schemas. Custom schemas now persists on the browser's localStorage, making it more convient for peope working on non-soported schemas. Custom scheams needs a name, the schema url, and optional (but recommended) CSS URL. The document's root element is used to determine the mappings.

### New dialog box

Started the transition of Messages and Confirmation Dialog Box to React. Introduce new Dialog Box manager, new designs and UX. Implemented on:

- Load schema process
- Editor mode
- Annotation mode
- Schema change

### 4. Close Event

`onClose` event allows the parent holding LEAF-Writer to react when the editor is about to close.

### Minor Changes

- Validador: Add validation feedback in the bottom bar [66ee06f2746b829f64a823427ee0727bea169cbd]
- Better handling non suported schemas, add custom schema, new dialog boxes, onClose event [f10426f84b954161bade42f4105bd05a5d1823ea]
  - Includes:
    - Split Dialogs from Components on file tree
    - Add types
    - Localization

### Patch

- Tag person: Alphabetize list of roles [1085f1ee0b87cdf8a4dae9a3f98740ffd023e237]
- Fix typo in a dialog box message [a1a9e72b621f588a3b80ceca83df485570a58d4b]
- Context menu: improve header hightlight [d9771768d4691e36ff96402804e99911a1e56806]
- Warning before close tab/window if dcoument has changes [f5de1b40c35a104ff04d130c59702a34416c89e1]
- localStorage: improve api to ge from / set to localStorage [26a29af3cfd797562dab1a4efe7d497ca8a84462]
- Theme: Tweak colour on dark mode [2800bf6f10edea5ff28444b7d8e1dd52b40351d3]
- Schemas: Reorder list [57b851b64057c041dfc9b83e2836feb8406b8a15]
- Types: Fix type source on package.json [d653f15247d5e6f560c2a5806a7885147603077d]
- eslint: add plugin to lint typescript [82521ec420b43585187157292a3e9f9a52749197]
- i18n: tweak configure and add scope (namespace) [c456a509c5a3bdc32ff43a891036f70a3ad6a28d]
- Editor mode: rename options [e919bd2937ea40fa1f6047b178d0c7873366205a]
- Update Dependencies [d60a2b7eb487387f0e394d792cce23e89e986f5d]
  - core:
    - add:
      - mui-modal-provider@2.1.0
    - upgrade:
      - uuid@9.0.0
    - update:
      - @fortawesome/fontawesome-free@6.2.0
      - @mui/icons-material@5.10.3
      - framer-motion@7.3.5
      - prismjs@1.29.0
      - react-router-dom@6.4.0
    - bump up:
      - @emotion/react@11.10.4
      - @emotion/styled@11.10.4
      - @mui/lab@5.0.0-alpha.99
      - @mui/material@5.10.5
      - i18next@21.91.1
      - jquery@3.6.1
      - luxon@3.0.3
      - overmind@28.0.2
      - overmind-react@29.0.2
      - rdflib@2.2.20
      - react-i18next@11.18.6
      - wikidata-sdk@8.0.3
  - dev:
    - update:
      - @typescript-eslint/eslint-plugin@5.37.0
      - @typescript-eslint/parser@5.37.0
      - esbuild-loader@2.20.0
      - eslint-plugin-react@7.31.8
    - bump up:
      - @types/luxon@3.0.1
      - @types/node@18.7.18
- Updated dependencies
  - @cwrc/leafwriter-validator@1.2.0

## 1.7.0

### Minor Changes

- Add link to the documentation in the ribbon [9121ab1181737f64e223d7a9f8d4713dfdf8dba1]
- Add link to report bugs at the bottom bar [6d6c10654ba1339bb493d09c89a89ae7ec9dd9a5]

### Patch Changes

- Geonames: remove extra `$` signal in the request URL [c9dc8303147e201f6c4a78f8e1fae838e5d3f0f6]
- Getty: remove the proxy server. Call it directly from the browser [14c5236ab401070282df2df1059987e35dc49ed5]

## 1.6.2

### Patch Changes

- New release

## 1.6.1

## Fix

[1a1b40580f5cd1c8ae62a7f089ee58be5abef9b5] Web annotation: re add app version and rename app to 'LEAF-Writer'

## Chore

[59a052cb25abfb2856ea58830c8433ff16f2994c] Organize tinyMCE files

## 1.6.0

### Features

[569c99ae3633b84631c46a50e20eb9acb9227592] Schema: drop support to Moravian schema. **THIS IS A BREAKING CHANGE!!!**

## Fix

[db576550322f22e89814ae0dc0860a6fcdcc8c93] Fullscreen: move modals to a more internal div so htey can be displayed correctly in fullscreen

## Dependencies

[74b9e893d425c95b3331d66e6eccf4d44342818c] Update dependencies

- core
  - update
    - @mui/lab@5.0.0-alpha.92
    - @mui/material@5.9.2
    - framer-motion@6.5.1
    - react@18.2.0
    - react-dom@18.2.0
    - react-i18next@11.18.1
    - react-intersection-observer@9.4.0
  - bump up
    - @dnd-kit/core@6.0.5
    - @dnd-kit/sortable@7.0.1
    - @fortawesome/fontawesome-free@6.1.2
    - i18next@21.8.14
    - iso-639-2@3.0.2
    - jquery-ui@1.13.2
    - rxjs@7.5.6
- dev
  - update
    - @types/node@18.6.1
    - @typescript-eslint/eslint-plugin@5.31.0
    - @typescript-eslint/parser@5.31.0
    - webpack@5.74.0
  - bump up
    - @types/chroma-js@2.1.4
    - @types/react-dom@18.0.6
    - eslint-plugin-react@7.30.1
    - mini-css-extract-plugin@2.6.1

## 1.5.0

### Major

This version brings 2 main features and several minor updates.
These main features are a break, but since we are still in development, it will be just a minor bump.

1. Remove the necessity for a proxy to load external resource due to CORS issues
2. Simplify lookups configuration

### Features

#### [43132f4ce3b961330f0b061b95b10f8698640e0a] Load schemas [break]

LEAF-Writer does its best to load the document's schema and CSS from an external URL. However, some external resources can be blocked by CORS. For instance, `tei-c.org` does not allow external connections, so LEAF-Writer cannot load schemas from this domain. The request could also fail due to error 400-500 or loss of internet connection.

We add alternative URLs to remediate this situation. LEAF-Writer will first try to load the schema declared in the document. If it fails, it will try alternative sources listed under each supported schema.

For example, a TEI-ALL document that points to the following schema:

- `https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng`

In addition, LEAF-Writer supports the following URLs for a TEI-ALL document:

- `https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng`
- `https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_all.rng`

LEAF-Writer will try to load the document's declared schema first, if it fails it will try the alternatives.

**Note:** LEAF-Writer does not change the document's schema declaration. The replacement only impacts on internal LEAF-Writer functions (i.e., tree navigation, validation, tag suggestions, etc).

#### [66438425a1209f6206f4b82a2e59fe1421cbe6c0] Simplify Lookups Configuration [break]

LEAF-Writer has a set of entity lookups setup: `DBPedia`, `Geonames`, `Getty`, `LGPN`, `VIAF`, `Wikidata`. All, but two, are enabled unless it is custom configured. All entity types are enabled by default.

`LGPN` is set OFF by default due to its high specificity (Greek terms only). It can still be enabled in the settings panel.

`Geonames` endpoint requires a username. The username must be provided in the config object in order enable Geonames.

The shape of the config object is the following:

```ts
{
  authorities: Array<
    | Authority
    | [
        Authority,
        {
          config?: {
            username?: string;
          };
          enabled?: boolean;
          entities?: Array<[NamedEntityType, boolean]>;
        },
      ]
  >;
}
```

The `authorities` object can be a mixed array with:

1. The authority's name (above). Just the name is enough to enable a disabled authority (e.g., `LGPN`)
2. OR a tuple containing the authority's name and a config object. Here one can enable/disable an authority completely, or enable/disable specific entity types (`person`, `place`, `organization`, `title`, `thing`). One can also pass a config object with the username (e.g., Geonames)

We also removed mentions to `CWRC` and `NSSI` authorities. Instead of these two, we will provide access to the `LINCS` authority as soon as it goes live. [369bd4956e9b54ad56ff2d7a6d0b68a0b7c687eb]

### Fix

[ae03f777904f61fe222d8c3b497a58ba288066d4] Tweak LEAF-writer exit

[ed9bfb435d17f9ef0bd42eba123df54c6d4ad56a] Contextmenu: tweak the position from where context menu popup

[a2c99438178dac8c5b4fb2e6d07a6389d1c1bb88] Fullscreen: Change the fullscreen container

[41c59add878bf857ea6ceac2b7f3ff16515616a2] schemas: update epidoc rng source url to https

[5e0e0a4bc46b5cdea1a74848442b1865fdcd0b9b] config: remove mentions to nerveUrl. Make optional baseUrl and proxy loader

[523cdd3d85788ff1785daf2198f3db02ce977980] Entity list: fix content overflow and action button's color

[4cde50006fe5f8f5bdca4b7a62071d9e05f79440] image viewer: add prefix to css classes to avoid external collision

### Types

[91b6a9822695b6f3985d57a4631b88f7d27128fb] Types: add missing types

### Dependencies

[f6cc1a5698eb957952f7031d9b19a2781321bf93] dev: upgrade: @types/luxon@3.0.0

[56796149fc00d025ca59c6b76ac28b6d2f60272f] core: upgrade luxon@3.0.1

### Docs

[cf7d82b27f690f9327c72b187258b17c865ef2f1] tweak inline documentation

## 1.4.2

### Patch Changes

- Scrape Candidate Entities: convert map to array

## 1.4.1

### Patch Changes

- [fix]

  - [Settings Panel] Adjust lookups spacing and overall look
  - [Settings Panel] Improve header. Add close button.
  - [Status / bottom bar] Remove box shadow for better external integration
  - [General] Manage main container. Auto-defines the container height if not pre-defined

  [chore]

  - [webpack] Rename less parent Id to create a scope for leafwriter less generated css
  - [webpack] Unset publicPath. We can later use gloval var `webpack_public_path` to dynamically set the path where the files will be located. This is usuful for external integration where we don't know here the files will be placed.
  - [package] Expose both ts (for impor) and js (for require) on package.json

## 1.4.0

### Minor Changes

- changes how LEAF-Writer configures itself, specifically the path to dep files and proxies

## 1.3.0

### Minor Changes

- 2a97acf: Allows to open the settings dialog from outside LEAF-Writer

## 1.2.1

### Patch Changes

- 5c31be0: Build: fix tinymce css path

### Minor Changes

[0e565de]

- [feat] Add a log manager to improve dev/prod versions
  - We use loglevel to control when to output logs (no more dirty logs on production version).

[1e4b13b]

- **Leaf-write as a instanciable class**
  - Create a new instance passing the content and config.
  - Expose several apis to retrive the content and control the editor through the instance.
  - Handle onload / onchange events
- [Top Bar] Remove topbar and move settings to a dialog
  - The previous topbar functionalities are not a specific concern to Leaf-writer.
  - The client must implements load/save funcioalinities, as well as auth and storage.
  - The seetings panel is now a dialog that is accessible through the editor ribbon.
- [Entity lookups] Better error handling
- [Editor] Fix bug preventing toggle shwow tags
- [Theme] Entities are optional to avoid propagation to leaf-writer commons
- [Contentmenu] Simplify skeleton size
- [Perf] Add types
- [Chore] Rename folder @types to types
- [Chore] Format with prettier and remove empty lines
- [Dependencies] Update

### Patch Changes

[924a08a]

- **Update to Reac 18**
  - Update dependencies
