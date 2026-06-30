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

**Tagging** — see **`docs/tagging-planning.md`**
- [x] Enter-tag popup + F2 rename + insert/split (Phase 1)
- [x] Alt+Enter attribute popup + right attributes panel + Lookup + per-type colours (Phase 2)
- [x] Tag usage stats (element + attribute counts in `schema/tag-stats.json`)
- [x] Method for deleting tags in WYSIWYG.
- [x] In source, deleting open tag deletes the closing tag, and vice versa (unwrap).


**The wrapping vs. inside question** — this is the genuinely hard design problem. A few angles:

The distinction already exists implicitly: _selection determines relationship_. If you select "Jeff" while inside `<persName>Jeff</persName>`, the new tag wraps the selection and becomes a child of persName. If you select across the persName boundary, you get a parent or sibling. The schema validates the result either way. So for most cases, the user's selection _is_ the intent signal — no disambiguation needed.

Where it breaks down is **whole-tag operations**: cursor inside persName, you want to wrap the entire persName in something, or you want to replace persName with a different tag. Text selection can't express "select this entire element including its boundaries." The bubble is the natural answer here — clicking it could surface: _Edit attributes / Change tag / Wrap in… / Unwrap_. This covers the "structural" operations that selection-based tagging can't reach.

A possible clean model: **selection = always text/content tagging; bubble = structural operations on the element itself.** Users who understand the distinction will reach for the right tool instinctively. The one ambiguous case is selecting all the text inside a tag — does that mean "retag this content" or "wrap this element"? That might need a schema-aware heuristic or a simple one-click disambiguation in the bubble.


**Metadata**
- [x] Saving in the editor leaves a last-edited timestamp with the encoder name in `encodingDesc/appInfo` (TEI) or Orlando `RESPONSIBILITY[@RESP="Le Jean-Baptiste"]` — separate from scholarly `revisionDesc`

**CSS**
- [x] Per-type tag highlight + text colours — attributes panel → `schema/tag-colors.json` + CSS; see **`docs/tagging-planning.md`**

**Refinement**
- [x] In source mode, changing name of tag, closing tag should be updated in real time.
- [x] When copy and pasting into WYSIWYG, at the very least convert paragraph breaks to `<p>`

**UI**
- [x] Dark mode icons
- [x] Add a very thin bar below/in their place indicating xpath tree location (`/TEI/text/body/...` format).
- [x] Clean out their icons from the top once those functions are moved.
- [x] Source opens with cursor where you were in WYSIWYG
- [x] Navigating with tagging highlighting still counts as changes to undo.
- [x] enter -> p -> enter should do what
- [x] Get good highlighting on 'hybrid mode'
- [x] Harmonise icon size, left and right.
- [x] Make find and replace super efficient to use with keyboard only
- [x] Fix build error problem
- [ ] Fix cursor position navigating tags in WYSIWGY mode.
- [ ] Reflect on whether 'hybrid mode' should be its own, third mode.

**Presentation**
- [ ] clean up branding in docs
- [ ] change repo name

**Tools**
- [ ] Manual 'Time machine' w/ indexing (?), very efficient protocol.
- [ ] Method to add tag types and create custom schema.
- [ ] Export automated report of structure, number of tags, etc.

**Workshop invitees**
- JB
- Laetitia (transcriptions)
- Emanuella Garatti (talked to me about doing a database)
- Armelle Jammet (has an SQL database)
- Chao (prosopographie)
- Marie [assistant teacher?]
- Johan (knows everything)

---

**Later**
- [ ] Wrap paragraphs and other big things in larger wrappers
- [ ] Verify that we can stack tags inside AND outside of smaller elements.
- [ ] Improve Find and replace button layout
- [ ] Keyboard shortcuts for all side panels + everything useful
- [ ] Rethink context menu
- [ ] Make fuller list of project and file metadata to act as norm.
- [ ] Redo icon insignia OR splash?
- [ ] Splash?
- [ ] Figure out what to do about external documentation
- [ ] Website

**Auto-tagging**
- [ ] AI api integration for tagging without modifying the language (?).
- [ ] SQL integration (?)

**Disambiguation**
- [ ] Attribute propagation.
- [ ] Disambiguation queue + resolution-file attribute propagation (later phases)

**Versioning**
- [ ] Versioning files — see **`docs/versioning-planning.md`** (local history on save, rollback; medium priority)

**Testing**
- [ ] Debug auto metadata validation errors. 
- [ ] Test on Linux
- [ ] Test on Windows