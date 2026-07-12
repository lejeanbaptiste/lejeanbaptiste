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

The View menu's Reload / Force Reload / Toggle Developer Tools items only appear in development builds (`app.isPackaged === false`); they're stripped from packaged production builds.

## Production build

### macOS (.pkg)

```bash
npm run build:desktop
```

This builds Commons, compiles the Electron main/preload scripts, and packages a `.pkg` installer into `apps/desktop/release/`.

### Bundled Python runtime (all platforms)

Every package (mac `.pkg`, Linux `.deb`, Windows NSIS) bundles a relocatable
CPython (python-build-standalone) with the pinned `sanmiao` release
pip-installed into it. `scripts/download-python-runtime.mjs` fetches the
runtime for the host OS/architecture during `npm install` and before
packaging, staging it at `apps/desktop/resources/python/` — the same
repo-relative path on every dev machine and VM. The app prefers a sibling
`../sanmiao` dev checkout (editable venv), then the bundled runtime, then
system Python; `SANMIAO_PYTHON` overrides everything. End users need no
Python setup.

To bump Python or sanmiao, edit `PBS_TAG` / `PYTHON_VERSION` /
`SANMIAO_SPEC` at the top of the script; the stamp file forces a
re-download on the next install.

### Linux (.deb)

Extra system prerequisites (Debian/Ubuntu):

```bash
sudo apt install librsvg2-bin
```

`librsvg2-bin` provides `rsvg-convert` for icon export. Assembling the `.deb`
itself no longer needs the Ruby `fpm` gem — the build points
`CUSTOM_FPM_PATH` at `scripts/fpm-deb.mjs`, a small Node reimplementation of
the subset of `fpm` electron-builder needs, so nothing beyond Node has to be
installed.

Then, from the repo root:

```bash
npm run build:desktop:linux
```

The `.deb` lands in `apps/desktop/release/` (e.g. `le-jean-baptiste-desktop_0.0.1_arm64.deb`). Install it with:

```bash
sudo apt install ./apps/desktop/release/le-jean-baptiste-desktop_*.deb
```

For GitHub-hosted updates, the release workflow publishes a signed APT repo
to GitHub Pages. In repository settings, set Pages source to `GitHub Actions`.
The repository URL will look like:

```text
https://<owner>.github.io/<repo>/apt
```

After the signing key is added once, `apt update` will pick up new versions
automatically:

```bash
curl -fsSL https://<owner>.github.io/<repo>/apt/le-jean-baptiste-archive-key.asc \
  | sudo gpg --dearmor -o /usr/share/keyrings/le-jean-baptiste-archive-key.gpg
echo "deb [signed-by=/usr/share/keyrings/le-jean-baptiste-archive-key.gpg] https://<owner>.github.io/<repo>/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/le-jean-baptiste.list
sudo apt update
sudo apt install le-jean-baptiste-desktop
```

Platform-specific electron-builder settings live in `electron-builder.mac.json`, `electron-builder.linux.json`, and `electron-builder.win.json`, all extending `electron-builder.base.json`.

### Linux (Flatpak)

Flatpak packaging uses electron-builder’s `flatpak` target. On a machine with `flatpak-builder` installed, run:

```bash
npm run build:desktop:flatpak
```

The resulting `.flatpak` bundle lands in `apps/desktop/release/`. This is a
standalone install bundle, not an update channel. A true Flatpak update path
would need a repository-based Flatpak manifest and signing flow, which is not
set up yet.

### Linux (Arch / CachyOS)

For Arch-based systems, use the local PKGBUILD in `packaging/arch/`:

```bash
cd packaging/arch
makepkg -si
```

This produces a native Arch package for the host architecture (`x86_64` or
`aarch64`).

### Windows (NSIS)

```bash
npm run package:win -w le-jean-baptiste-desktop
```

The `prepackage:win` hook exports the icon and stages the bundled Python
runtime (see above) before electron-builder assembles the installer.

### Notes

- **Host platform:** `npm run package` builds the mac `.pkg` installer. Use `npm run package:linux` for the Linux `.deb`, `npm run package:win` for the Windows NSIS installer, or `npm run package:mac` to be explicit.
- **No code signing:** Unsigned builds may require right-click → Open on first launch.
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
