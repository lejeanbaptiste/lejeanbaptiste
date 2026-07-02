# Translation Mode — Smoke Test Checklist

Manual regression checklist for the translation feature (see `docs/translation-planning.md`).
Run against a scratch project with a couple of TEI files. Items marked **⚠ linking** are the
ones that can silently corrupt source↔translation correspondence — prioritize those.

**Setup for a full run:** a project with `alignmentUnit: p`, two languages (`fr`, `de`), one
file with existing translations, one file never translated, one file with no `xml:id`s at all.
To reset a file's translation state: delete its `*.translation.xml` companions and remove
`xml:id` attributes from its paragraphs.

---

## 1. Settings (Edition metadata dialog)

- [x] Project → Edition metadata… opens with a Translation section (alignment-unit radio + language list).
- [x] First save with a language typed but **not** added via the Add button still saves that language (no silently-empty language list).
- [x] Reopen dialog: alignment unit is now locked (radios disabled); languages remain addable.
- [x] Add a second language, save — no "settings already exist" error; `schema/translation-settings.json` has both languages, original `alignmentUnit` untouched.
- [x] Second Save click in the same dialog session doesn't error (stale-lock regression).

## 2. First-time indexing (⚠ linking)

- [x] Open a file with **no** `xml:id`s on its paragraphs; open the Translation tab; pick a language. (Problem: durring processing, it hops back to project metadata, and one has to renavigate to the translation panel. Instead, there should be a quick loading bar on that panel)
  - Source file on disk gains `xml:id` on every `<p>` (prefix `twu-`), silently — no confirmation dialog, no "file changed externally" prompt, no reload flicker losing edits.
  - `file.fr.translation.xml` appears next to the source with one element per source unit, each carrying `corresp="file.xml#<id>"`, contents empty.
- [x] Ids that already existed are **never** changed (put a hand-written `xml:id="mine"` on one paragraph first; verify it survives and the companion references it).
- [x] Switch the language dropdown to the second language — a second independent companion is created; the first is untouched.
- [x] Structural shell mirrors the source (same div nesting above the paragraphs), and no content below the alignment unit is copied into the companion.

## 3. Selection sync & editing (⚠ linking)

- [x] Click into different paragraphs in the source — the pane swaps to each unit's translation. Verify the *text shown actually belongs to the clicked paragraph* (the core correspondence check: put distinct translations in p1/p2/p3 and click each).
- [x] Type a translation, click away (blur) — reopen the companion file raw: the text landed inside the element whose `@corresp` matches the paragraph you were on, not a neighbor.
- [x] Bold/italic/underline round-trip through blur + file reload.
- [x] Switch language mid-edit — pane shows the other language's content for the same unit; edits don't bleed between languages.
- [x] Switch to another file and back — pane still tracks the cursor (no dead pane until restart).
- [x] Open a file, don't move the cursor, open the Translation tab — pane shows the unit the cursor is already in (initial-sync check).
- [x] Cursor in a heading or outside any paragraph — pane shows the "select a paragraph" placeholder, not stale content.

## 4. Splitting & reindex (⚠ linking — highest corruption risk)

- [x] **Split at very end of a paragraph** (Enter with caret after the last character): a new empty sibling paragraph is created, cursor moves into it, and it has **no** `xml:id` until save (never a copy of the original's).
- [x] **Split mid-paragraph**: both halves render; the second half has a fresh internal id. After **save**: both halves have distinct `xml:id`s on disk; the *first* half keeps the original id.
- [x] After that save, the companion file: the original translation stays attached to the **first** half's id; the split-off half has a new empty unit. No translation text duplicated across both halves.
- [x] Reindex-on-save is gated: with the Translation tab **closed**, saving a file with duplicate ids (paste a paragraph) does *not* rewrite companions; with the tab open, it does.
- [x] Copy-paste a whole paragraph (duplicate `xml:id`) then save with the tab open — duplicate resolved, first occurrence keeps the id, translations preserved.
- [x] Immediately after a reindex-save, the pane shows current content (not a stale pre-reindex snapshot), and no "file changed externally" prompt appears.
- [x] **Merge/delete a paragraph** whose translation exists, then save — known behavior: the orphaned unit stays in the companion until the next reindex actually runs; verify nothing crashes and other units keep their links.

## 5. Find / Replace

- [x] "Documents" dropdown next to Scope: Source / Translation / Both.
- [x] Scope=Current file, Documents=Both, search a word that exists **only in the translation** — companion hits appear even though the companion isn't an open tab.
- [x] Documents=Source hides companion hits; Documents=Translation hides source hits (both for Current file and Project scope).
- [x] Click a translation hit: opens the source file, switches to the Translation tab + right language, selects the containing paragraph in the source, and selects the matched text in the pane. **Never** opens the companion as a document ("Root element translation not supported" regression).
- [x] The *auto*-jump to the first result right after pressing Find behaves the same as clicking (second code path regression).
- [x] Two occurrences of the search word in one translated paragraph: clicking each result highlights its own occurrence, not the first twice.
- [x] After a jump, arrow keys still navigate the results list (focus not stolen by the editor).
- [ ] Replace-all with Documents=Translation rewrites companion files on disk; with Documents=Source leaves them untouched. **⚠ linking:** verify replace in a translation never alters `corresp` attributes (search for a string that appears in an attribute value, e.g. part of a filename).

## 6. XPath

- [x] Project-scope XPath (`//p`) returns no hits from `*.translation.xml` files.
- [x] XPath with a translation file somehow active errors cleanly ("does not apply to translation files") rather than crashing.

## 7. File lifecycle (⚠ linking)

- [x] Rename `a.xml` → `b.xml`: companions become `b.fr.translation.xml` etc., **and** their internal `corresp` values are rewritten to `b.xml#…` (open the companion raw to verify). Pane linking still works after the rename: click a translated paragraph, its translation shows.
- [x] Move a source into a subfolder: companions follow.
- [x] Delete a source: companions deleted too.
- [x] Rename/move/delete a **folder** containing source+companions: everything travels together, no double-cascade errors.
- [ ] Rename a file with **no** companions: works exactly as before (no-op cascade).

## 8. Isolation / invisibility

- [x] Companion files never appear in the explorer tree, even after New Folder/refresh.
- [ ] Edition metadata "Save and update documents…" bulk-apply does not touch companion files.
- [x] Companion files never open as tabs from any path (find, xpath, recent files).
- [ ] With no translation settings configured, everything above is inert: no companion probing on save, Find behaves classically, Translation tab shows the "configure in Edition metadata" hint.

## 9. Restart / cold start

- [x] Quit and relaunch: Translation tab works on first use without re-indexing already-indexed files (no duplicate id churn, no rewrite of companions).
- [x] Open the Translation tab *before* any file is open — no crash; behaves once a file is opened. (Impossible, panel not shown until file opened.)
