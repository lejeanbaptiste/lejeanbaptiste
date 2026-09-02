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

- [x] Click into different paragraphs in the source — the pane swaps to each unit's translation. Verify the _text shown actually belongs to the clicked paragraph_ (the core correspondence check: put distinct translations in p1/p2/p3 and click each).
- [x] Type a translation, click away (blur) — reopen the companion file raw: the text landed inside the element whose `@corresp` matches the paragraph you were on, not a neighbor.
- [x] Bold/italic/underline round-trip through blur + file reload.
- [x] Switch language mid-edit — pane shows the other language's content for the same unit; edits don't bleed between languages.
- [x] Switch to another file and back — pane still tracks the cursor (no dead pane until restart).
- [x] Open a file, don't move the cursor, open the Translation tab — pane shows the unit the cursor is already in (initial-sync check).
- [x] Cursor in a heading or outside any paragraph — pane shows the "select a paragraph" placeholder, not stale content.

### 3b. Card reader (continuous unit list)

- [ ] Translation pane shows **all** linked units open in one scrollable column (full text for inactive units; one shared toolbar — no per-card buttons or visible xml:ids).
- [ ] Active unit has a red left-edge bar and hosts the rich editor + footnotes.
- [ ] Edit unit A, click unit B (or use prev/next in the toolbar), return to A — A's text is still saved on the correct `@corresp` unit.
- [ ] Clicking a card selects the matching paragraph in the source; moving the caret in the source scrolls/highlights the matching card.
- [ ] Find jump to a translation hit still opens the right card and highlights the match.

## 4. Splitting & reindex (⚠ linking — highest corruption risk)

- [x] **Split at very end of a paragraph** (Enter with caret after the last character): a new empty sibling paragraph is created, cursor moves into it, and it has **no** `xml:id` until save (never a copy of the original's).
- [x] **Split mid-paragraph**: both halves render; the second half has a fresh internal id. After **save**: both halves have distinct `xml:id`s on disk; the _first_ half keeps the original id.
- [x] After that save, the companion file: the original translation stays attached to the **first** half's id; the split-off half has a new empty unit. No translation text duplicated across both halves.
- [x] Reindex-on-save is gated: with the Translation tab **closed**, saving a file with duplicate ids (paste a paragraph) does _not_ rewrite companions; with the tab open, it does.
- [x] Copy-paste a whole paragraph (duplicate `xml:id`) then save with the tab open — duplicate resolved, first occurrence keeps the id, translations preserved.
- [x] Immediately after a reindex-save, the pane shows current content (not a stale pre-reindex snapshot), and no "file changed externally" prompt appears.
- [x] **Merge/delete a paragraph** whose translation exists, then save — known behavior: the orphaned unit stays in the companion until the next reindex actually runs; verify nothing crashes and other units keep their links.

## 5. Find / Replace

- [x] "Documents" dropdown next to Scope: Source / Translation / Both.
- [x] Scope=Current file, Documents=Both, search a word that exists **only in the translation** — companion hits appear even though the companion isn't an open tab.
- [x] Documents=Source hides companion hits; Documents=Translation hides source hits (both for Current file and Project scope).
- [x] Click a translation hit: opens the source file, switches to the Translation tab + right language, selects the containing paragraph in the source, and selects the matched text in the pane. **Never** opens the companion as a document ("Root element translation not supported" regression).
- [x] The _auto_-jump to the first result right after pressing Find behaves the same as clicking (second code path regression).
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
- [x] Open the Translation tab _before_ any file is open — no crash; behaves once a file is opened. (Impossible, panel not shown until file opened.)

## 10. AI translate — entity placeholders (⚠ linking + LJBtero formatting)

**Pipeline (shipped):**

1. Collect keyed mentions from the **serialized source-unit XML** (`collectEntitiesFromSourceUnitXml`: `persName`, `placeName`, `orgName`, `title`, `bibl`, `roleName`, `officeName`, plus `name[@type=personWrapper][@key]`).
2. Blind before the model sees the unit (`replaceEntitiesWithPlaceholdersInSourceXml`):
   - Norbert `personWrapper` → `{{holding:OFFICE}} {{entity:PERSON}}` (title held + person).
   - Office immediately after `為` → `{{as:KEY}}` (or `{{as:opaque:N}}` if unkeyed).
   - Other keyed spans → `{{entity:KEY}}` (outermost keyed nest only).
   - Unkeyed leftover entity tags → `{{opaque:N}}`.
   - `nobleTitle` (and nested place/role) → **plain text** for the model to translate (not blinded yet).
   - Adjacent placeholders get a single space; runs of spaces collapse.
3. AI payload sends **id + kind only** (no romanized/primary names). Dates payload sends **index only**.
4. If required placeholders are missing from the reply, resend up to **Placeholder retry limit** (Settings → AI API, 0–5).
5. Repair smart-quoted placeholders; strip “Governor of …” / “In/On …” glued onto placeholders; substitute into atomic `ref[type="ljb-entity"]` / date fields. Offices with a gloss default to translation-only display.

**Automated:** `sourceUnitEntities.test.ts`, `aiPlaceholderGuard.test.ts`, `substituteEntityPlaceholders.test.ts`, office/display tests in `entityDisplay.test.ts`.

**Manual (requires saved source + configured AI API):**

- [ ] **Save the source file first** so the unit XML sent to the model includes the keyed tags.
- [ ] Unit with one keyed mention of each kind (person, place, org, work/title, roleName), all resolved in the entity DB.
- [ ] Norbert unit with `personWrapper` (holding office + person) appointed `為` a new office — console blinded XML shows `{{holding:…}} {{entity:…}}為{{as:…}}` (or `{{as:opaque:…}}`).
- [ ] Unit with `nobleTitle` (e.g. 貞陽公 / 江夏王) — those strings remain as Chinese in the blinded XML for free translation; nested place keys are not cut out.
- [ ] Translation pane → Generate translation (blank unit only).
- [ ] In the companion raw XML or the pane: keyed mentions are `ref type="ljb-entity" key="…"` — **not** plain English invented by the model.
- [ ] Offices with an EN/FR gloss show the gloss alone by default (no pinyin/characters).
- [ ] Deliberately break a model reply (or use a weak model): with retry limit ≥ 1, console shows a retry; with limit 0, no retry.
- [ ] If placeholders remain missing after retries, check `ai-translation-debug.jsonl` and the console for `[translation] placeholders still missing`.

## 10b. AI translate — date placeholders (LJBtero Sanmiao glosses)

**Pipeline (shipped):** `collectDatesFromSourceUnitXml` gathers `<date>` spans in document order. Before the model sees the unit, `replaceDatesWithPlaceholdersInSourceXml` swaps each `<date>…</date>` for a bare `{{date:N}}`. The dates list sent to the model is index-only (gloss applied locally after substitute). Leading In/On/En/Le before a date field or `{{date:N}}` are stripped. After the response, `substituteDatePlaceholders` builds atomic `ref[type="ljb-date"]` fields.

**Automated:** `dateGloss.test.ts`, `substituteDatePlaceholders.test.ts`, `adjustDatePrepositions.test.ts`.

**Manual:**

- [ ] Source unit with a resolved Sanmiao `<date>` (parse children + `@when`).
- [ ] Generate translation → companion shows `ref type="ljb-date"` whose text matches LJBtero (year/month/day slots, Emperor …, Roman months, italic ganzhi, Western date in parentheses when day-level) — AI may keep by/until/before before the field; only in/on (en/le) are auto-adjusted to granularity.
- [ ] Untagged / structure-less dates still free-translate (no placeholder).

## 10c. AI translate — note splitting

**Pipeline (shipped):** `collectNotesFromSourceUnitXml` gathers top-level `<note>` spans in document order (a note nested inside another note is left alone — its content stays as plain prose inside the parent note's own translation). Before the model sees the main unit, `replaceNotesWithPlaceholdersInSourceXml` swaps each `<note>…</note>` for a bare `{{note:N}}`. Each note's own content is independently blinded (same entity/date pipeline, sharing the main text's known entity keys and an offset opaque-index counter so `{{opaque:N}}` never collides between the main text and a note) and sent as its own AI request — sequentially, only after the main-text translation succeeds. After both come back, `substituteNotePlaceholders` drops each note's translated, fully-substituted HTML into a real `<note place="foot">` element at the placeholder's position; the existing footnote normalizer (`normalizeFootnoteNotes`, already wired to run on every unit content change) numbers and wraps it exactly like a manually inserted footnote. A note that fails to translate (API error, still-missing placeholders, or invalid returned XML) falls back to its original untranslated content rather than failing the whole generation, and is surfaced as a status warning.

**Automated:** `sourceUnitNotes.test.ts`, `substituteNotePlaceholders.test.ts` (`TranslationPane.test.ts` or equivalent), opaque-offset coverage in `sourceUnitEntities.test.ts`.

**Manual:**

- [ ] Source unit containing `<note place="foot">…</note>` inline (e.g. `<p>Claim.<note place="foot">See discussion.</note></p>`) with plain prose only.
- [ ] Generate translation → the main translated text reads naturally with **no** note prose leaked into it, and a numbered footnote appears below with the note's own independently-translated content.
- [ ] The generated `<note>` is a real editable footnote — same shape (`[data-leaf-fn-mark]` / `[data-leaf-fn-body]`) as one created via the manual **Insert footnote** toolbar action.
- [ ] Source unit with a note containing a keyed entity or a `<date>` — the footnote's translated text resolves the entity/date field correctly (not left as a raw `{{entity:…}}` / `{{date:N}}` token).
- [ ] Unit with two or more notes — each gets its own footnote, numbered in document order, and `{{opaque:N}}` in one note's console-logged blinded XML never collides with another note's or the main text's.
- [ ] Force a note-translation failure (e.g. temporarily break the API mid-run) — main translation still completes, the note keeps its original (untranslated) text, and the success status mentions the note(s) that could not be translated.
- [ ] Unit with no notes — behavior is unchanged from before this feature (no `{{note:…}}` handling touches the main text).

## 10d. Mention-faithful entity rendering

**Pipeline (shipped):** Each keyed source span becomes one manifest row (`MentionContext`) blinded as `{{mention:N}}` (or `{{holding:N}}` / `{{as:N}}` for offices). After AI translate, `substituteMentionPlaceholders` renders atomic `ref[type="ljb-entity"]` chips from the DB using the as-written surface, resolved role (courtesy, partial given, place-as-written, …), and **file-wide** first vs later occurrence. Western targets (`en`, `fr`, `de`) show romanization + Chinese on first file mention; CJK targets (`zh`, `ja`, `ko`, `lzh`) show characters only (no romanization) with CJK life-date typography on first mention. Partial kinship names respect the user **brackets policy** (`never` / `first-mention-only` / `always`). Manual insert and autocomplete use the same renderer.

**Automated:** `mentionContext.test.ts`, `mentionRender.test.ts`, `fileWideOccurrence.test.ts`, updated `sourceUnitEntities.test.ts` (blinding tokens).

**Manual (蔡約 sample unit):**

- [ ] AI-generate in `fr`: courtesy 景撝 ≠ canonical “Cai Yue”; partial 廓 shows `[Cai] Kuo` or `Kuo` per brackets policy; places romanize surface only (no DB admin suffix); second file mention of the same person drops Chinese and dates.
- [ ] AI-generate in `zh-Hans`: no Latin romanization; partial 廓 may show `（蔡）廓` when brackets policy allows; entity life dates use Western years in Chinese typography, e.g. `（127～200年）`.
- [ ] Autocomplete: typing `kuo` / `廓` suggests mention-shaped previews that match the inserted chip.
- [ ] Insert menu lists **one row per manifest mention** (duplicate keys allowed), not deduped by entity id.
- [ ] Chinese/Japanese asset onboarding offers **Script conversion (OpenCC)**; after install, `zh-Hans` companions show simplified forms (國→国) and `ja` companions show shinjitai (濟→済) on entity chips.
