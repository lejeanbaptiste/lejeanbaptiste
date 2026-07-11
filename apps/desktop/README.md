# Le Jean-Baptiste (Desktop)

Electron desktop shell for LEAF-Writer Commons.

## Prerequisites

- Node.js 20+
- npm workspaces installed from the repo root: `npm install`

## Development

Run the web app and Electron window together (from repo root):

```bash
npm run dev:desktop
```

Or in two terminals:

```bash
npm run dev -w leafwriter-commons
npm run dev -w le-jean-baptiste-desktop
```

The Electron window opens at `http://localhost:3000/project`.

**First launch can take ~30 seconds** while webpack compiles; the desktop shell waits for the dev server and `js/app.js` before opening the window. If you still see an error, wait until the terminal shows `Compiled successfully`, then reload the window (Cmd+R).

Optional: set `LJB_OPEN_DEVTOOLS=1` to open Chromium DevTools in development.

## Production build

### macOS (.pkg)

```bash
npm run build:desktop
```

This builds Commons, compiles the Electron main/preload scripts, and packages a `.pkg` installer into `apps/desktop/release/`.

The mac package bundles a relocatable CPython (python-build-standalone) with
the Sanmiao date-tagger deps preinstalled — `scripts/download-python-runtime.mjs`
fetches it during `npm install` / packaging, and the app prefers it over any
system Python. End users need no Python setup.

### Linux (.deb)

Extra system prerequisites (Debian/Ubuntu):

```bash
sudo apt install librsvg2-bin ruby ruby-dev
sudo gem install fpm
```

`librsvg2-bin` provides `rsvg-convert` for icon export; `fpm` is what electron-builder uses to assemble the `.deb`.

Then, from the repo root:

```bash
npm run build:desktop:linux
```

The `.deb` lands in `apps/desktop/release/` (e.g. `le-jean-baptiste-desktop_0.0.1_arm64.deb`). Install it with:

```bash
sudo apt install ./apps/desktop/release/le-jean-baptiste-desktop_*.deb
```

The package declares the Python runtime deps for the bundled Sanmiao date tagger
(`python3-pandas`, `python3-numpy`, `python3-lxml`), so apt installs them
automatically — end users don't need to know Python is involved.

Platform-specific electron-builder settings live in `electron-builder.mac.json` and `electron-builder.linux.json`, both extending `electron-builder.base.json`.

### Notes

- **Host platform:** `npm run package` builds the mac `.pkg` installer. Use `npm run package:linux` for the Linux `.deb`, or `npm run package:mac` to be explicit.
- **No code signing:** Unsigned macOS builds may require right-click → Open on first launch.
- If the build fails with `unable to locate '...leafwriter-validator.worker.js'`, build the validator package first: `npm run build -w @cwrc/leafwriter-validator`.
- The bundled LemMinX XML language server is currently downloaded for macOS only; Linux builds skip it.
- The packaged app starts a local Express server and loads the `/project` route.

## License notices

The desktop build bundles third-party runtime components such as Electron, TinyMCE, `monaco-editor`, `jszip`, `mammoth`, and `@xmldom/xmldom`. Their license pointers are tracked in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

## Features (Phase 1)

- Open a project folder and browse `.xml` files in a sidebar tree
- Multiple document tabs in one window
- Save to disk (Cmd+S)
- XPath search on the current file (toolbar button)
