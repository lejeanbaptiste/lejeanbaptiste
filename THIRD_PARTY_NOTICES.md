# Third-Party Notices

Leaf Writer and the Le Jean-Baptiste desktop shell include third-party software that keeps its own upstream license terms. This file is a practical pointer to the major runtime dependencies we bundle or rely on directly.

When shipping releases, keep this document in sync with the actual dependency set in `package.json` and the generated lockfile. Transitive dependencies are covered by their own upstream licenses through the npm dependency tree.

## Major runtime components

- `TinyMCE` - rich-text editor used in the main editing surface.
- `monaco-editor` - code editor used for source-oriented editing views.
- `Electron` - desktop shell runtime for the packaged app.
- `jszip` - archive handling used by import/export workflows.
- `mammoth` - Word document conversion support in the desktop app.
- `@xmldom/xmldom` - XML DOM implementation used by the desktop app.

## Repository licenses

- The repository itself is licensed under `GPL-2.0` as declared in the root `package.json`.
- Individual upstream dependencies may use different licenses. Their exact terms should be taken from the package metadata that ships with each dependency version.

## Where to verify

- Root workspace dependencies: `/Users/daniel/Code/leaf-writer/package.json`
- Desktop app dependencies: `/Users/daniel/Code/leaf-writer/apps/desktop/package.json`
- Core editor dependencies: `/Users/daniel/Code/leaf-writer/packages/cwrc-leafwriter/package.json`
- Generated dependency tree: `/Users/daniel/Code/leaf-writer/package-lock.json`

If you add a new runtime dependency, please update this file and any release packaging steps so the license notice travels with the app.
