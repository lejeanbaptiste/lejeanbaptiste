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

```bash
npm run build:desktop
```

This builds Commons, compiles the Electron main/preload scripts, and packages for the current host platform into `apps/desktop/release/`.

### Notes

- **Host platform:** `npm run package` uses the mac packaging config. Use `npm run package:linux` if you want the Linux stream, or `npm run package:mac` to be explicit.
- **No code signing:** Unsigned builds may require right-click → Open on first launch.
- The packaged app starts a local Express server and loads the `/project` route.

## License notices

The desktop build bundles third-party runtime components such as Electron, TinyMCE, `monaco-editor`, `jszip`, `mammoth`, and `@xmldom/xmldom`. Their license pointers are tracked in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

## Features (Phase 1)

- Open a project folder and browse `.xml` files in a sidebar tree
- Multiple document tabs in one window
- Save to disk (Cmd+S)
- XPath search on the current file (toolbar button)
