# @cwrc/leafwriter-storage-service

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
