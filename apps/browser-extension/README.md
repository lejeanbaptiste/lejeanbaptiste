# Grognard corpus import extension

Manifest V3 extension for **Chrome / Brave / Edge** and **Firefox**, on
**macOS, Linux, and Windows**. Sends the current **Wikisource**, **Kanripo**,
or **BDRC** page to Grognard.

The content scripts only read the URL — no page text is scraped.

## Layout

The shared sources (`content*.js`, `popup.*`, `icons/`) live in this folder.
Only the manifest differs per browser:

- `manifest.json` — Chrome family (carries the pinned `key`).
- `manifest.firefox.json` — Firefox (`browser_specific_settings.gecko.id`).

The toolbar / management icon is the Grognard app icon (`icons/icon-*.png`), exported
from `apps/desktop/resources/branding/icon.svg` with the outer margin cropped so
the maroon tile fills the toolbar slot. Regenerate with
`npm run icon:export` (or `node scripts/export-browser-extension-icons.mjs`).

## Install (end users)

Download the extension zips from the [same GitHub release](https://github.com/grognard/grognard/releases/latest) as the desktop app (`grognard-browser-extension-chromium-*.zip` and `grognard-browser-extension-firefox-*.zip`). Step-by-step instructions for every browser and OS are in the main [readme.md](../../readme.md#browser-extension-corpus-import).

## Install from a git checkout (developers)

### Chrome / Brave / Edge

1. Start **Grognard** once (writes the native-messaging manifests).
2. `brave://extensions` (or `chrome://extensions`) → Developer mode →
   Load unpacked → **this folder**.

### Firefox

1. Build the Firefox bundle:
   ```sh
   ./build-firefox.sh
   ```
   This assembles `dist/firefox/` (shared sources + `manifest.firefox.json`
   renamed to `manifest.json`).
2. Start **Grognard** once (registers the native-messaging host — see
   _Native-messaging host_ below).
3. `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
   pick `dist/firefox/manifest.json`.

   A temporary add-on is cleared when Firefox restarts. For a persistent
   install, package `dist/firefox/` with `web-ext` and sign it, or use
   Firefox Developer Edition / Nightly with `xpinstall.signatures.required`
   set to `false`.

## Native-messaging host

Starting Grognard registers the native host `org.grognard.import`
so the extension can reach the running app. This is automatic on **macOS,
Linux, and Windows**:

|         | Chrome / Brave / Chromium / Edge                                                                                                  | Firefox                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| macOS   | `~/Library/Application Support/<Browser>/NativeMessagingHosts/org.grognard.import.json`                                     | `~/Library/Application Support/Mozilla/NativeMessagingHosts/…`         |
| Linux   | `~/.config/<browser>/NativeMessagingHosts/org.grognard.import.json`                                                         | `~/.mozilla/native-messaging-hosts/…`                                  |
| Windows | `HKCU\Software\<Vendor>\…\NativeMessagingHosts\org.grognard.import` → manifest in `%APPDATA%\Grognard\native-host\` | `HKCU\Software\Mozilla\NativeMessagingHosts\org.grognard.import` |

The manifest allows the Chrome extension id `dddnkaleimllefhfolmhdfbidnjfojjh`
(pinned by `key` in `manifest.json`) and the Firefox add-on id
`grognard-corpus-import@grognard.org`. On Windows the host is launched through
a generated `grognard-browser-host.bat` (the browser can only spawn `.exe`/`.bat`/
`.cmd`); macOS and Linux use a generated shell launcher. All three run the host
script through the app's bundled Node, so no system `node` is required.

Registration is per-user and needs no elevation. It is refreshed every launch;
uninstalling Grognard leaves the stale entry behind (harmless — it just fails to
connect).

## Use

Open a page and click **Import**:

- **Wikisource** — any chapter or work-root page.
- **Kanripo** — a text whose URL carries `#KR1a0030_001` (juan) or
  `#KR1a0030` (work).
- **BDRC** — an etext reader page on `library.bdrc.io` (URL carries
  `openEtext=bdr:VE…`). The extension names the volume; Grognard resolves it to
  the paginated `UT…_0000` transcription and fetches from the Public Data
  Interface.

See [docs/wikisource-import.md](../../docs/wikisource-import.md) (Wikisource),
[docs/kanripo-import-plugin-planning.md](../../docs/kanripo-import-plugin-planning.md) (Kanripo),
and [docs/bdrc-import-planning.md](../../docs/bdrc-import-planning.md) (BDRC).
