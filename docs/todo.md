# Todo

See **`docs/project-schema-planning.md`** for Open Project, project metadata, New File (⌘N), schema setup, and skeleton design.

**Phase 1 smoke test:** complete — see **`docs/smoke_test.md`**.

**Phase 2 smoke test:** section I (New File) — run manually in desktop dev build; automated skeleton tests in `apps/commons/src/desktop/newFileSkeleton*.test.ts`.

**Phase 3 smoke test:** section J (File metadata panel) — run manually in desktop dev build; automated tests in `apps/commons/src/desktop/fileMetadata.test.ts`.

Interface:
- [x] Dark mode icons
- [ ] Clean out their icons from the top once those functions are moved.
- [ ] Add a very thin bar below/in their place indicating xpath tree location.

Menu
- [x] Open Project — schema setup when folder has no schema (download or copy local); then project metadata dialog (required Save)
- [x] Project → Edition metadata… — edit `schema/project-metadata.json`; optional apply to existing XML files
- [x] New File (⌘N) — temp file + Save As; skeleton merges project metadata defaults; Save As defaults from explorer focus; prompt on close if unsaved (Save / Don't save / Cancel) + temp cleanup

Settings
- [x] Encoder name — pre-fill `titleStmt/principal` in project metadata dialog on new setup (see planning doc)

Editor / right rail
- [x] Right panel icon strip (icons instead of text labels where space is tight)
- [x] File metadata panel — first icon; default panel when a file opens (title, sourceDesc, …)
- [ ] Attributes panel — tag attrs + Lookup… + per-type colours; see **`docs/tagging-planning.md`** Phase 2

Editor
- [ ] Fast add tag — see **`docs/tagging-planning.md`** (Enter-tag popup, Phase 1)
- [ ] Fast add attributes — see **`docs/tagging-planning.md`** (Phase 3+; separate from identify path)
- [ ] AI api integration for tagging without modifying the language (?).
- [ ] Attribute panel — see **`docs/tagging-planning.md`** (Attributes panel, Phase 2)
- [ ] SQL integration (?)
- [ ] Versioning files — see **`docs/versioning-planning.md`** (local history on save, rollback; medium priority)

**Tagging** — see **`docs/tagging-planning.md`**
- [ ] Enter-tag popup + F2 rename + insert/split (Phase 1)
- [ ] Alt+Enter attribute popup + right attributes panel + Lookup + per-type colours (Phase 2)
- [ ] Tag/attr usage stats + customisable keybindings
- [ ] Disambiguation queue + resolution-file attribute propagation (later phases)
- [ ] Completely rethink the tagging paradigm (umbrella — tracked in planning doc)

**Metadata**
- [ ] Saving in the editor should leave a 'last edited' timestamp with the user name (see planning doc Phase 6)

**CSS**
- [ ] Per-type tag highlight + text colours — attributes panel → `schema/tag-colors.json` + CSS; see **`docs/tagging-planning.md`**

**Refinement**
- [ ] Improve fixed layout of things in find and replace
- [ ] Make find and replace super efficient to use with keyboard only
- [ ] Keyboard shortcuts for all side panels
- [ ] In source mode, changing name of tag, closing tag should be updated in real time.
- [ ] When copy and pasting into WYSIWYG, at the very least convert paragraph breaks to <p>
- [ ] Make fuller list of project and file metadata to act as norm.

**Testing**
- [ ] Test on Linux
- [ ] Test on Windows