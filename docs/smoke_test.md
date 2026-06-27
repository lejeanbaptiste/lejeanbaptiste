Smoke-test checklist (manual)
Run the desktop app from a dev build. Use a fresh empty folder and a folder with existing XML separately.

A. First-time project (empty folder)

- [x] Open Project (⌘O) → create/select empty folder → schema setup wizard appears. DPM: YES, but very slow to open.

- [x] Wizard shows TEI All and TEI Lite as selectable; “More schemas…” entries visible but disabled

- [x] Download TEI Lite → schema/tei_lite.rng (+ CSS) on disk; jean-baptiste.project.json updated with catalogId, hashes, version

- [x] Project metadata dialog opens immediately after schema install; cannot dismiss without Save

- [x] Leave most fields blank → Save → schema/project-metadata.json exists with empty/minimal fields

- [x] Explorer loads; no document auto-created

B. First-time project (local schema)

- [x] New empty folder → wizard → Use local schema file… → pick a .rng from disk.

- [x] Files copied into schema/ with original filenames preserved

- [x] Metadata dialog appears (custom/local note if non-catalog TEI)

- [x] Re-open same project → no schema wizard, no metadata dialog

C. Settings — encoder name

- [x] Settings → set encoder name → Save/close

- [x] New empty project through schema + metadata setup → Principal field pre-filled from Settings

- [ ] Change Settings encoder name → re-open existing project metadata → principal not auto-overwritten

D. Existing project (schema + metadata already present)

- [x] Open folder that already has schema/*.rng and project-metadata.json → no wizards

- [x] Open an XML file from explorer → editor loads; validation uses local schema (check validator / no network fetch for RNG)

E. Edition metadata (Project menu)

- [x] Project → Edition metadata… opens dialog with saved values

- [ ] Edit licence/funder → Save defaults only → JSON updated; open XML files unchanged

- [ ] Edit a default again → Save and update documents… → confirm → managed fields updated in XML under project tree

- [ ] title and sourceDesc in files not changed by bulk apply

- [ ] Add a custom metadata row → save → apply → custom path appears in file headers

F. Unsaved guard

- [ ] Open project, edit a file (dirty tab) → Open Project again → prompted: Save all / Don’t save / Cancel

- [ ] Cancel → stay on current project with edits intact

- [ ] Save all → saves then opens new project
G. Failure / edge cases

- [ ] Simulate failed catalog download (offline or bad URL) → no partial schema/; project JSON unchanged; user can retry or pick local file

- [ ] Copy schema/ folder from one project to another → open copy → schema works; metadata available via Edition metadata menu

- [ ] Project with XML in subfolders → bulk apply reaches nested *.xml, skips schema/
H. Regression

- [ ] Save / Save As still work on an open file

- [ ] Restore last project on app launch runs same onboarding gates (schema/metadata) if folder incomplete

- [ ] Native Settings and document schema picker (missing schema on file open) still work