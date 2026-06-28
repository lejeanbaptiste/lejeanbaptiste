# Smoke-test checklist (manual)

**Status:** Phase 1 smoke test **complete** (June 2026). Phase 2 (New File) **ready for manual pass** — section I below. Core flows verified in a desktop dev build (`npm run dev:desktop`). Section G edge cases deferred.

Run the desktop app from a dev build. Use a fresh empty folder and a folder with existing XML separately.

## A. First-time project (empty folder)

- [x] Open Project (⌘O) → create/select empty folder → schema setup wizard appears
- [x] Wizard shows TEI All and TEI Lite as selectable; “More schemas…” lists TEI Simple Print, jTEI, and Orlando (selectable)
- [x] Download TEI Lite → schema/tei_lite.rng (+ CSS) on disk; jean-baptiste.project.json updated with catalogId, hashes, version
- [x] Project metadata dialog opens after schema install; cannot dismiss without Save
- [x] Leave most fields blank → Save → schema/project-metadata.json exists with empty/minimal fields
- [x] Explorer loads; no document auto-created



## B. First-time project (local schema)

- [x] New empty folder → wizard → Use local schema file… → pick a .rng from disk
- [x] Files copied into schema/ with original filenames preserved
- [x] Metadata dialog appears (custom/local note if non-catalog TEI)
- [x] Re-open same project → no schema wizard, no metadata dialog



## C. Settings — encoder name

- [x] Settings → set encoder name → Save/close
- [x] New empty project through schema + metadata setup → Principal field pre-filled from Settings
- [ ] Change Settings encoder name → re-open existing project metadata → principal not auto-overwritten *(not re-checked this pass)*



## D. Existing project (schema + metadata already present)

- [x] Open folder that already has schema/*.rng and project-metadata.json → no wizards
- [x] Open an XML file from explorer → editor loads; validation uses local schema (check validator / no network fetch for RNG)



## E. Edition metadata (Project menu)

- [x] Project → Edition metadata… opens dialog with saved values (pooled window; fast after first load)
- [x] Save defaults only / Save and update documents… — JSON and XML updates work; custom rows apply to headers
- [x] `titleStmt/title` and `sourceDesc` in files not changed by bulk apply
- [x] Add / remove custom metadata rows → save → apply → custom path appears in (or is cleared from) file headers



## F. Unsaved guard

- [x] Open project, edit a file (dirty tab) → Open Project again → prompted: Save all / Don’t save / Cancel
- [x] Cancel → stay on current project with edits intact
- [x] Save all → saves then opens new project



## G. Failure / edge cases *(deferred)*

- [ ] Simulate failed catalog download (offline or bad URL) → no partial schema/; project JSON unchanged; user can retry or pick local file
- [ ] Copy schema/ folder from one project to another → open copy → schema works; metadata available via Edition metadata menu
- [ ] Project with XML in subfolders → bulk apply reaches nested *.xml, skips schema/



## H. Regression

- [x] Save / Save As still work on an open file (including temp `untitled.xml` → Save As)
- [x] Restore last project on app launch runs same onboarding gates (schema/metadata) if folder incomplete
- [x] Native Settings and document schema picker (missing schema on file open) still work



## I. New File (⌘N)

Prerequisites: project open with TEI Lite or TEI All schema and `schema/project-metadata.json` (fields may be blank). Set edition metadata fields in **Project → Edition metadata…** first if you want to verify header merge.

- [x] ⌘N → `untitled.xml` tab opens; caret in first body paragraph; non-blank edition metadata fields appear in header (if set in project metadata)
- [x] Edit body → Save (⌘S) → Save As dialog opens; default folder is **project root** when nothing is focused in explorer
- [ ] Focus a folder in explorer → ⌘N → edit → Save → Save As defaults to that **folder**
- [ ] Focus a file in explorer → ⌘N → edit → Save → Save As defaults to that file's **parent folder**
- [x] Save into project → file appears in explorer; tab title/path updates; tab no longer temp; Save (⌘S) writes to that path without dialog
- [x] ⌘N → edit → close tab (×) with **Save…** → Save As → file saved; tab closes
- [x] ⌘N → edit → close tab with **Don't Save** → tab gone; no stray temp file left in project folder
- [x] Close tab with **Cancel** on the prompt → tab stays open with edits intact
- [ ] ⌘N without a project open → “Open a project first” / open-project prompt
- [x] Validation panel shows valid document for new skeleton (manual check)
- [ ] Re-run section H (Save / Save As regression) after New File flows



## J. File metadata panel (east rail)

Prerequisites: TEI project open (TEI All or TEI Lite); at least one XML file with a `<teiHeader>`.

- [x] Open an XML file from explorer → east rail opens; **File metadata** icon is active (first icon in strip)
- [x] Panel shows **Title** and **Source** from the file header (`titleStmt/title`, `sourceDesc/p`)
- [x] Edit **Title** in panel → change appears in Source mode (or body if header visible); tab marked dirty
- [x] Edit **Source** in panel → same
- [x] Switch to another open tab → panel reloads values for that file
- [x] **Project → Edition metadata…** → Save and update documents… still skips title and sourceDesc in files (section E regression)
- [ ] Read-only mode → panel fields disabled (There is no read-only mode)
- [x] East rail tabs show icons with tooltips (File metadata, Image Viewer, Validation)



## K. Expanded catalog (Phase 4)

Prerequisites: fresh empty folders (one per schema type below).

- [x] Schema wizard **More schemas…** — TEI Simple Print, jTEI, and Orlando are selectable and download
- [x] TEI Simple Print: metadata dialog → Save → `schema/project-metadata.json` with `catalogId: "teiSimplePrint"`
- [x] jTEI: metadata dialog → Save → `catalogId: "jTei"`
- [x] Orlando: metadata dialog → Save → `catalogId: "orlando"`; edition fields use Orlando header paths (Authority, Encoder)
- [x] ⌘N on TEI Simple Print project → valid skeleton; caret in first body paragraph
- [x] ⌘N on jTEI project → valid skeleton; caret in first body paragraph
- [x] ⌘N on Orlando project → valid `ENTRY` skeleton with biography + writing starters; caret in first `<p>` (Author summary)
- [x] File metadata panel on TEI Simple Print / jTEI file → Title + Source (TEI paths)
- [x] File metadata panel on Orlando file → Title (`DOCTITLE`) + Source (`SOURCEDESC`)
- [x] **Project → Edition metadata…** → Save and update documents… still skips per-file title/source fields (section E regression)



## L. Schema update check

Prerequisites: catalog-installed project (e.g. TEI Lite from schema wizard) with `sourceHash` / `sourceCssHash` in `jean-baptiste.project.json`. Online.

- [x] Open project with current upstream hashes → no update dialog
- [x] Tamper `sourceHash` in project JSON and **save the file** (or wait for real upstream change) → **Schema update available** dialog appears after project loads
- [ ] Choose **Not now** → project stays on current schema; no files changed
- [x] Choose **Update now** → previous `.rng` / `.css` copied to `schema/_archive/`; project JSON hashes and `installedVersion` refreshed
- [x] Project with a custom metadata row → after update, snackbar warns to review custom path(s)
- [ ] Local-schema project (no `catalogId`) → no update check / dialog
- [ ] Re-open same project within 24h after a check → no second network check (`lastCheckedAt` throttle)



## M. Source linked tag editing

Prerequisites: desktop dev build; TEI file open in **Source** mode.

- [x] Place caret in an opening tag name (e.g. `<p>`) and rename it → matching `</p>` updates in real time
- [x] Place caret in a closing tag name (e.g. `</p>`) and rename it → opening tag updates in real time
- [x] Prefixed tag (e.g. `<cb:div>…</cb:div>`) renames both sides together
- [x] Nested same-name tags (e.g. `<div><div>…</div></div>`) link only the innermost pair at the caret
- [x] Self-closing tag (e.g. `<pb/>`) does not trigger linked rename
- [ ] Edit Source dialog (if used) behaves the same as main Source pane



## N. Phase 6 polish

Prerequisites: catalog-installed TEI project with edition metadata; encoder name set in Settings.

- [x] **File → Check for schema updates…** on up-to-date project → “Schema is up to date.” snackbar (no 24h wait)
- [x] Tamper `sourceHash` in project JSON, save, then **File → Check for schema updates…** → update dialog appears
- [x] Local-schema project → menu check shows “local schema” snackbar
- [x] TEI file → edit body → Save → `encodingDesc/appInfo/application[@ident="le-jean-baptiste"]` with encoder name and date; re-save updates same entry; `revisionDesc` unchanged
- [ ] Orlando file → Save → `REVISIONDESC/RESPONSIBILITY[@RESP="Le Jean-Baptiste"]` updated with encoder name and date; other `RESPONSIBILITY` entries unchanged
- [ ] Edition metadata → bulk apply → change one file’s managed field in file metadata panel → change edition default → bulk apply again → edited file keeps its value; others update
- [ ] After bulk apply, `schema/project-metadata.json` contains `lastApplied` snapshot



## O. Tagging Phase 1 (Enter popup, F2, split)

Prerequisites: desktop dev build; TEI project open; **Visual** mode; **Show tags** on (optional, for visibility).

- [x] Select text + **Enter** → tag popup opens; last-used tag highlighted; **Enter** in popup wraps selection
- [ ] Collapsed caret + **Enter** → insert popup; `p` highlighted; must confirm with **Enter**
- [x] **F2** on tagged element → rename popup with current tag name; **Enter** commits rename
- [x] **F2** on explorer file/folder → rename dialog opens
- [ ] F2 walk
- [ ] **Shift+Enter** in inline tag → line break / parent splits when schema allows
- [x] Tag popup **Shift+Enter** → all exact untagged matches in file wrapped; one undo
- [x] Tag popup **Alt+Enter** → queue-walk through untagged matches
- [x] Invalid tag greyed in popup; apply refused with snackbar
- [ ] Save file → `schema/tag-stats.json` updated with element counts
- [x] **Source** mode: Enter/F2 do not open tag popup (linked rename in source still works)