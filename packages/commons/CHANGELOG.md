## 1.3.0
### Major

This version brings two new features:

1. Remove endpoints acting as proxy for loading external resources.
2. New logo :)

### Features

[892431842c5f4e9d528fa534c9819d2787e9a820] server: remove endpoints acting as proxy for loading external resources due to CORS. LEAF-Writer will handle this internally.
[5d85f0c2da0a92fe733497561e7ad5c90168d527][e7fb7df8fb66e155158a49250f207b1983b294c7] New logo

### Fix

[d076bc471a019a195c1f19d126117d9ddc272960] Adjust homepage layout on mobile
[2c27a2a03059a71afce5748f7bf00e3fe52c2d97] leafwriter config: remove baseUrl and nerveUrl
[d11962a645d08d87344b64da132cd3acd6c02e91] Remove configurations for CWRC lookups (deprecated)

### Patch Changes

- Updated dependencies
  - @cwrc/leafwriter@1.5.0

## 1.2.2

### Patch Changes

- changes how LEAF-Writer configures itself, specifically the path to dep files and proxies
- Updated dependencies
  - @cwrc/leafwriter@1.4.0

## 1.2.1

### Patch Changes

- 2a97acf: Allows to open the settings dialog from outside LEAF-Writer
- Updated dependencies [2a97acf]
  - @cwrc/leafwriter@1.3.0

### Minor Changes

[0e565de]

- [feat] Add a log manager to improve dev/prod versions
  - We use loglevel to control when to output logs (no more dirty logs on production version).
- [fix] Mimetype on storage service panel: from `text/xml` to `application/xml`
- [fix] Add language to main html tag

[1e4b13b]

- **Leaf-write as a instanciable class**
  - Create a new instance passing the content and config.
  - It requires the content to be edit a set of config options.
  - Track onload/onchange events
- [UX] New top bar
  - Includes load/save funcionalities, keyboard shortcuts, metadata and profile
- [UX] Redesing storage panel and sign section
- [UX] Improve auth state and profile UI
- [UX] Add settings to profile menu
- [UX] New Icons
- [Progress] New loading animation
- [Chore] Split overmind state/actions
- [Chore] Rename folder @types to types
- [Chore] Rename config file
- [Chore] Add prettier to eslint
- [Dependencies] update

### Patch Changes

[924a08a]

- **Update to Reac 18**

  - Update dependencies

[924a08a]

- Updated dependencies
  - @cwrc/leafwriter@1.2.0
  - @cwrc/leafwriter-storage-service@1.1.0
