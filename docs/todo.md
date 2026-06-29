# Todo

**Menu**
- [x] Open Project — schema setup when folder has no schema (download or copy local); then project metadata dialog (required Save)
- [x] Project → Edition metadata… — edit `schema/project-metadata.json`; optional apply to existing XML files
- [x] File → Check for schema updates… — on-demand catalog hash check (bypasses 24h throttle)
- [x] New File (⌘N) — temp file + Save As; skeleton merges project metadata defaults; Save As defaults from explorer focus; prompt on close if unsaved (Save / Don't save / Cancel) + temp cleanup

**Settings**
- [x] Encoder name — pre-fill `titleStmt/principal` in project metadata dialog on new setup (see planning doc)

**Editor / right rail**
- [x] Right panel icon strip (icons instead of text labels where space is tight)
- [x] File metadata panel — first icon; default panel when a file opens (title, sourceDesc, …)
- [x] Attributes panel — tag attrs + Lookup… + per-type colours; see **`docs/tagging-planning.md`** Phase 2

**Editor**
- [x] Fast add tag — Enter-tag popup, F2 rename, Shift+Enter line break (Phase 1); see **`docs/tagging-planning.md`**
- [x] Fast add attributes — Alt+Enter attribute popup (Phase 2); see **`docs/tagging-planning.md`**
- [x] Attribute panel — see **`docs/tagging-planning.md`** (Attributes panel, Phase 2)
- [ ] Versioning files — see **`docs/versioning-planning.md`** (local history on save, rollback; medium priority)

**Tagging** — see **`docs/tagging-planning.md`**
- [x] Enter-tag popup + F2 rename + insert/split (Phase 1)
- [x] Alt+Enter attribute popup + right attributes panel + Lookup + per-type colours (Phase 2)
- [x] Tag usage stats (element + attribute counts in `schema/tag-stats.json`)
- [x] Method for deleting tags in WYSIWYG.
- [x] In source, deleting open tag deletes the closing tag, and vice versa (unwrap).
- [ ] Attribute propagation.
- [ ] Customisable keybindings (Phase 6)
- [ ] Disambiguation queue + resolution-file attribute propagation (later phases)

**Auto-tagging**
- [ ] AI api integration for tagging without modifying the language (?).
- [ ] SQL integration (?)

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
- [x] Source opens with cursor where you were in WYSIWYG
- [ ] Harmonise icon size, left and right.
- [ ] Navigating with tagging highlighting still counts as changes to undo.
- [ ] Improve fixed layout of things in find and replace
- [ ] Make find and replace super efficient to use with keyboard only
- [ ] Keyboard shortcuts for all side panels
- [ ] Rethink context menu

**Testing**
- [ ] Debug auto metadata validation errors. 
- [ ] Test on Linux
- [ ] Test on Windows