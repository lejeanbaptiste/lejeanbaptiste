## 1.1.2

### Patch Changes### Chore

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
