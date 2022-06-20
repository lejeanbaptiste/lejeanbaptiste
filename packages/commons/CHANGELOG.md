## 1.2.0

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
