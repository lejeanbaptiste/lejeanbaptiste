# Todo

See **`docs/project-schema-planning.md`** for Open Project, project metadata, New File (⌘N), schema setup, and skeleton design.

**Phase 1 smoke test:** complete — see **`docs/smoke_test.md`**.

**Phase 2 smoke test:** section I (New File) — run manually in desktop dev build; automated skeleton tests in `apps/commons/src/desktop/newFileSkeleton*.test.ts`.

**Phase 3 smoke test:** section J (File metadata panel) — run manually in desktop dev build; automated tests in `apps/commons/src/desktop/fileMetadata.test.ts`.

**Phase 4 smoke test:** section K (Expanded catalog) — run manually in desktop dev build; automated skeleton tests cover `teiSimplePrint`, `jTei`, and `orlando` in `apps/commons/src/desktop/newFileSkeleton*.test.ts`.

**Phase 5 smoke test:** section L (Schema update check) — run manually in desktop dev build; automated tests in `apps/commons/src/desktop/schemaUpdateLogic.test.ts`.

**Phase 6 smoke test:** section N (Polish) — run manually in desktop dev build; automated tests in `apps/commons/src/desktop/revisionDescXml.test.ts` and `metadataApplyOverrides.test.ts`.

**Tagging Phase 1 smoke test:** section O — run manually in desktop dev build; automated tests in `apps/commons/src/desktop/tagging/*.test.ts`.

**Tagging Phase 2 smoke test:** section P (Attributes) — run manually in desktop dev build; automated tests in `apps/commons/src/desktop/tagging/*.test.ts`.

Menu
- [x] Open Project — schema setup when folder has no schema (download or copy local); then project metadata dialog (required Save)
- [x] Project → Edition metadata… — edit `schema/project-metadata.json`; optional apply to existing XML files
- [x] File → Check for schema updates… — on-demand catalog hash check (bypasses 24h throttle)
- [x] New File (⌘N) — temp file + Save As; skeleton merges project metadata defaults; Save As defaults from explorer focus; prompt on close if unsaved (Save / Don't save / Cancel) + temp cleanup

Settings
- [x] Encoder name — pre-fill `titleStmt/principal` in project metadata dialog on new setup (see planning doc)

Editor / right rail
- [x] Right panel icon strip (icons instead of text labels where space is tight)
- [x] File metadata panel — first icon; default panel when a file opens (title, sourceDesc, …)
- [x] Attributes panel — tag attrs + Lookup… + per-type colours; see **`docs/tagging-planning.md`** Phase 2

Editor
- [x] Fast add tag — Enter-tag popup, F2 rename, Shift+Enter line break (Phase 1); see **`docs/tagging-planning.md`**
- [x] Fast add attributes — Alt+Enter attribute popup (Phase 2); see **`docs/tagging-planning.md`**
- [ ] AI api integration for tagging without modifying the language (?).
- [x] Attribute panel — see **`docs/tagging-planning.md`** (Attributes panel, Phase 2)
- [ ] SQL integration (?)
- [ ] Versioning files — see **`docs/versioning-planning.md`** (local history on save, rollback; medium priority)

**Tagging** — see **`docs/tagging-planning.md`**
- [x] Enter-tag popup + F2 rename + insert/split (Phase 1)
- [x] Alt+Enter attribute popup + right attributes panel + Lookup + per-type colours (Phase 2)
- [x] Tag usage stats (element + attribute counts in `schema/tag-stats.json`)
- [ ] Customisable keybindings (Phase 6)
- [ ] Disambiguation queue + resolution-file attribute propagation (later phases)
- [ ] Method for deleting tags in WYSIWYG.
- [x] In source, deleting open tag deletes the closing tag, and vice versa (unwrap).

**Metadata**
- [x] Saving in the editor leaves a last-edited timestamp with the encoder name in `encodingDesc/appInfo` (TEI) or Orlando `RESPONSIBILITY[@RESP="Le Jean-Baptiste"]` — separate from scholarly `revisionDesc`

**CSS**
- [x] Per-type tag highlight + text colours — attributes panel → `schema/tag-colors.json` + CSS; see **`docs/tagging-planning.md`**

**Refinement**
- [x] In source mode, changing name of tag, closing tag should be updated in real time.
- [x] When copy and pasting into WYSIWYG, at the very least convert paragraph breaks to `<p>`
- [ ] Make fuller list of project and file metadata to act as norm.

**UI**
- [x] Dark mode icons
- [x] Add a very thin bar below/in their place indicating xpath tree location (`/TEI/text/body/...` format).
- [x] Clean out their icons from the top once those functions are moved.
- [ ] Improve fixed layout of things in find and replace
- [ ] Make find and replace super efficient to use with keyboard only
- [ ] Keyboard shortcuts for all side panels
- [ ] Rethink context menu
- [x] Source opens with cursor where you were in WYSIWYG

**Testing**
- [ ] Debug auto metadata validation errors. 
- [ ] Test on Linux
- [ ] Test on Windows