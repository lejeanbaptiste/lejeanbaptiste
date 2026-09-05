# Wikisource import

**Status (2026-08-29):** Built-in desktop import plus a Brave/Chromium extension. Grognard fetches wikitext and Wikidata; the extension only sends a page order.

## In Grognard

1. Open a **TEI** project (not Orlando / jTEI).
2. **File → Import from Wikisource…**
3. Paste a `*.wikisource.org` URL and **Inspect**.
4. If several edition trees exist (punctuated chapters vs `Title (四庫全書本)`), pick one.
5. **Import** writes `{project}/imported/wikisource/{workTitle}/{chapter}.xml` (one file per chapter or juan). Stop keeps files already written.

A chapter URL (`荀子/勸學篇`) imports that page only. A work root (`荀子`) imports every page in the chosen tree.

Metadata: Wikidata sitelink Q-id from the **work root** (authors P50, Ctext P4517, date P577 only when present). Wikidata wins over `{{header}}`; the Wikisource credit line is kept in `<note type="wikisource-header">`. Missing page breaks are recorded in `<note type="extraction">`.

## Browser extension (Brave)

1. Start Grognard once so it can write native-messaging manifests (Linux: `~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/org.grognard.import.json`).
2. Open `brave://extensions` → Developer mode → **Load unpacked** → `apps/browser-extension`.
3. On a Wikisource page, click the extension → **Import**. Confirm in Grognard.

The first-run explainer lives in the extension (`?` to show it again). Talk / `Index:` / `Page:` / author / portal pages are rejected in the popup.

If Grognard is not running, the popup says so. Node.js must be on `PATH` for the native host (`grognard-browser-host`).

Pinned extension id: `dddnkaleimllefhfolmhdfbidnjfojjh`.

## Kanripo via the same extension

On [kanripo.org](https://www.kanripo.org), open a text whose URL hash names a KR id (e.g. `#KR1a0030_001` for one juan, or `#KR1a0030` for the whole work). Click **Import** in the extension. Grognard opens **Import from Kanripo** with the work pre-selected and import scope set (single juan vs full GitHub clone). Confirm and run import in the dialog.

The extension reads the hash, path, or `loc=` query parameter; it does not scrape page text.

## zh wikitext map

| Wikitext                                  | TEI                                                       |
| ----------------------------------------- | --------------------------------------------------------- |
| `{{header\|…}}`                           | Consumed (not dumped); author/title kept as header credit |
| `{{pb}}` / `{{pagenum}}` / `[[Page:…/n]]` | `<pb n="…"/>`                                             |
| `〈…〉`                                   | `<note type="comm">`                                      |
| Unknown `{{…}}`                           | Stripped                                                  |
| Blank line                                | `<p>`                                                     |

Other language wikis use a generic fallback (strip templates, paragraphs).

## Kanripo parallel punctuation

Kanripo still fetches Wikisource **HTML** for the tape engine. The shared module lives in Grognard (`apps/desktop/src/wikisource/wikisource-parallel.mjs`); the plugin re-exports it.

## Tests

```bash
node --test apps/desktop/src/wikisource/*.test.mjs
npm run test:wikisource -w @grognard/plugin-kanripo-import
```
