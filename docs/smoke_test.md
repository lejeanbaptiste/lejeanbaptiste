# Smoke-test checklist (manual)

**Status:** Phase 1 smoke test **complete** (June 2026). Phase 2 (New File) **ready for manual pass** — section I below. Core flows verified in a desktop dev build (`npm run dev:desktop`). Section G edge cases deferred.

Run the desktop app from a dev build. Use a fresh empty folder and a folder with existing XML separately.

## A. First-time project (empty folder)

- [x] Open Project (⌘O) → create/select empty folder → schema setup wizard appears
- [x] Wizard shows TEI All and TEI Lite as selectable; “More schemas…” entries visible but disabled
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
- [ ] Read-only mode → panel fields disabled
- [x] East rail tabs show icons with tooltips (File metadata, Image Viewer, Validation)