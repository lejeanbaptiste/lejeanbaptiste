# BDRC import — smoke test list

**Stage:** first cut — plugin scaffold, live PDI fetch/emit core, host dialog,
browser-extension adapter, on-disk cache. Not yet run inside the packaged app.

**Related planning:** [bdrc-import-planning.md](bdrc-import-planning.md).

**Known gaps going in** (don't file these as bugs):

- `<respStmt>` / `<author>` is **empty** — creator metadata from the `MW`/`WA`
  is not fetched yet (planning §4.1).
- Page breaks use the scan sequence number (`<pb n="3"/>`), not pecha folio
  labels (`1a`/`1b`) — planning §9.1.
- Every import is flat (no outline `<div>`s); editorial `[…]` brackets stay as
  literal text.
- `transcriptionMethod` is always `unknown` (no predicate exists).

---

## Prerequisites

- Sibling checkouts: `leaf-writer`, `plugins` (with `plugin-bdrc-import`).
- Network: `https://purl.bdrc.io` and `https://iiif.bdrc.io` reachable (no VPN
  that geoblocks Tibet).
- Desktop dev run:
  ```bash
  cd leaf-writer && npm run dev:desktop
  ```
  Fully quit + restart after pulling main/preload/dialog changes.
- **Tools → Plugins** → enable **BDRC import** for the test project.
- Test project: a **TEI** project (TEI All or TEI Lite) with a local schema.
  Orlando / jTEI projects should be refused with a clear message.

### Known-good references

| Ref                                                                                                                              | What it is                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `UT4CZ5369_I1KG9127_0000`                                                                                                        | Derge Kangyur, Vinaya vol. ka — `AccessOpen`, ~101 folios, has a git revision                       |
| `VE4CZ5369_I1KG9127`                                                                                                             | the same volume as a `VE…` id (must resolve to the `UT…_0000` above)                                |
| `https://library.bdrc.io/show/bdr:IE4CZ5369?scope=bdr:IE4CZ5369&openEtext=bdr:VE4CZ5369_I1KG9127&startChar=1&back=bdr:MW4CZ5369` | the BUDA reader URL for that volume                                                                 |
| `bdr:MW4CZ5369`                                                                                                                  | a work/instance ref — must be **rejected** with guidance                                            |
| _(pick one)_                                                                                                                     | a modern in-copyright etext at `AccessFairUse` / `AccessRestrictedByTbrc` — for the restricted path |

---

## Part 1 — Automated (CLI)

Run before any UI testing. All green today.

- [ ] **1.1** Unit tests (31):
      `bash
    node --test apps/desktop/src/bdrc/*.test.mjs
    `
- [ ] **1.2** Typecheck: `npm run typecheck --workspaces --if-present` — no `error TS`.
- [ ] **1.3** Lint/format: `npx prettier --check apps/desktop/src/bdrc` etc.
- [ ] **1.4** Plugin manifest: `cd ../plugins && npm run validate` → `plugin-bdrc-import` ok.
- [ ] **1.5** Plugin build: `npm run build -w @ljb/plugin-bdrc-import` → `dist/register.mjs`.
- [ ] **1.6** Live core smoke (hits purl.bdrc.io):
      `bash
    node --input-type=module -e '
      import("./apps/desktop/src/bdrc/pdiClient.mjs").then(async (m) => {
        const { extracted, warnings, revision, fromCache } =
          await m.importEtext("UT4CZ5369_I1KG9127_0000", { windowSize: 60000, maxWindows: 3 });
        console.log({ folios: extracted.chunks.length, revision: revision.slice(0,10), fromCache, warnings });
        console.log("facs[0]:", extracted.chunks[0]?.imageUri);
      });'
    `
      Expect ~100+ folios (this call caps at 3 windows — a real import fetches
      the whole volume), a 40-hex revision, `fromCache:false`, no warnings, and a
      `https://iiif.bdrc.io/bdr:I1KG9127::I1KG91270003.jpg/...` facs URL.
- [ ] **1.7** Open that facs URL in a browser → a real folio image (or its
      `.../info.json` → HTTP 200 IIIF Image API 2).

---

## Part 2 — Desktop dialog

Open via **File → Import from BDRC…**.

### 2.1 Guards

- [ ] Plugin disabled → menu item hidden (or action reports "enable the plugin").
- [ ] No project open → "Open a project first."
- [ ] Orlando / jTEI project → import refused with the TEI-only message.

### 2.2 Inspect

- [ ] Paste `UT4CZ5369_I1KG9127_0000` → **Inspect** → card shows a Tibetan title,
      `work WA0BC001`, `instance MW4CZ5369`, `access AccessOpen`, `status StatusReleased`.
- [ ] Paste `VE4CZ5369_I1KG9127` → Inspect resolves to the **same** volume.
- [ ] Paste the full reader URL → same result.
- [ ] Paste `bdr:MW4CZ5369` → error naming it a work/instance, pointing at the reader.
- [ ] Paste junk → "Not a recognisable BDRC etext reference".
- [ ] Enter key in the field triggers Inspect.

### 2.3 Import

- [ ] Import `UT4CZ5369_I1KG9127_0000` → progress bar → success line
      `Imported UT4CZ5369_I1KG9127_0000 (~101 folios).`
- [ ] File written to `<project>/imported/bdrc/MW4CZ5369/UT4CZ5369_I1KG9127_0000.xml`
      and opened in the editor.
- [ ] Re-import the same volume → new file `…_0000-2.xml` (no overwrite).
- [ ] Importing again with **"re-fetch (ignore local cache)"** ticked → succeeds,
      status has no "(from local cache)".

### 2.4 Output file

- [ ] Validates against the project schema (validator panel: **no errors**).
- [ ] `<text xml:lang="bo">`, body is one `<div type="text">` with a `<p>`.
- [ ] `<pb n="3"/>`, `<pb n="4"/>` … one per folio; `@facs` on each; `<lb/>` at line breaks.
- [ ] Tibetan punctuation (`།`, `་`, `༎`) present verbatim — **not** `<pc>`, no injected `<p>` splits.
- [ ] Header: `<idno type="URI">http://purl.bdrc.io/resource/UT4CZ5369_I1KG9127_0000</idno>`,
      `<idno type="BDRC">MW4CZ5369</idno>`, `type="BDRC-work"` WA0BC001, `type="BDRC-volume"` I1KG9127.
- [ ] `<availability status="free">` with the BDRC attribution string.
- [ ] `<revisionDesc><change>` names the UT id, image group, git revision, `bdrc-import`.
- [ ] `<respStmt>` is empty — expected (known gap).

### 2.5 Restricted volume

- [ ] Inspect a `AccessFairUse` / `AccessRestrictedByTbrc` UT → card shows the tier
      and a warning; **Import** button disabled (or import returns the "not released" error).
- [ ] No file is written.

---

## Part 3 — Browser extension

- [ ] Load `apps/browser-extension` unpacked in Brave/Chrome (Developer mode → Load unpacked).
- [ ] `manifest.json` version is `0.3.0`; `library.bdrc.io` in host permissions.
- [ ] Start LJB with a project open (writes the native-messaging manifest).
- [ ] Open the reader URL above on `library.bdrc.io`. Click the extension → **Import**.
- [ ] Popup intro/explainer text mentions BDRC.
- [ ] LJB comes to the foreground and **Import from BDRC** opens with the ref pre-filled
      and Inspect already run.
- [ ] Confirm → volume imports as in Part 2.
- [ ] On a non-etext BDRC page (a work landing page, search) → popup says the page
      can't be imported (no `openEtext`).
- [ ] With LJB **not** running → popup says LJB is not running.
- [ ] Reload a BDRC tab that was open before the extension was installed → Import
      still works (content script injected on reload).

---

## Part 4 — Cache

Cache dir: `<userData>/bdrc-cache/` (macOS: `~/Library/Application Support/Le Jean-Baptiste/bdrc-cache/`).

- [ ] First import of a volume → a file `UT…__<40hex>.json` appears.
- [ ] Second import (same volume, cache toggle **off**) → status says
      "(from local cache)"; noticeably faster; only `/admindata/` is hit
      (check with a proxy/devtools if needed).
- [ ] "re-fetch" toggle **on** → the old cache entries for that UT are deleted and
      re-written.
- [ ] Delete the whole `bdrc-cache/` dir → next import re-fetches, no error.
- [ ] A volume with no `contentsGitRevision` (older/unsynced etext, if you can find
      one) → never written to the cache; always re-fetched.

---

## Part 5 — Failure modes

- [ ] Offline / purl.bdrc.io unreachable → Inspect and Import show a clear network
      error, no half-written file.
- [ ] `iiif.bdrc.io` unreachable but purl reachable → import still succeeds; `@facs`
      URLs are written (they just won't resolve).
- [ ] A `UT…` that 404s on `Etext_base` → clear "HTTP 404" error.
- [ ] Kill LJB mid-import → no partial `.xml` left in `imported/bdrc/`.
- [ ] Very large volume (e.g. a full Kangyur volume, ~1MB text) → completes; editor
      opens it without hanging.
