# LJB corpus import extension

Unpacked Manifest V3 extension for Brave (or Chrome). Sends the current
**Wikisource**, **Kanripo**, or **BDRC** page to Le Jean-Baptiste.

1. Start **Le Jean-Baptiste** once (writes native-messaging manifests).
2. `brave://extensions` → Developer mode → Load unpacked → this folder.
3. Open a page and click **Import**:
   - **Wikisource** — any chapter or work-root page.
   - **Kanripo** — a text whose URL carries `#KR1a0030_001` (juan) or `#KR1a0030` (work).
   - **BDRC** — an etext reader page on `library.bdrc.io` (URL carries
     `openEtext=bdr:VE…`). The extension names the volume; LJB resolves it to
     the paginated `UT…_0000` transcription and fetches from the Public Data
     Interface.

The content scripts only read the URL — no page text is scraped.

See [docs/wikisource-import.md](../../docs/wikisource-import.md) (Wikisource),
[docs/kanripo-import-plugin-planning.md](../../docs/kanripo-import-plugin-planning.md) (Kanripo),
and [docs/bdrc-import-planning.md](../../docs/bdrc-import-planning.md) (BDRC).
