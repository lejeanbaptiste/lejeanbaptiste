# Entity display: work types, title translations, period-filtered role translations

**Status (2026-08-05):** **Phase 0 shipped** (`work_type` + citation styling — schema migration6, repository, IPC chain, entity-editor UI, translation-pane italic/quote styling, tests). Phases 1–4 are still planning only. Follows the kind-aware entity display baseline (`entityDisplay.ts`, `EntityDisplayPopup.tsx`, `entityAutocomplete.ts`, dates restricted to person/work, `office_classifications` wired up) shipped earlier the same day.

## Context

The kind-aware formatter fixed the mechanical problem (place/org/office/work no longer get a person-shaped family/given split), but left real content gaps:

- **Titles (`work` kind)** have no type. We can't italicize a book, quote a chapter, or leave a painting unstyled, because nothing records which one it is.
- **Titles have no translation.** Scholarly convention needs both "_Hanshu_ 漢書 (History of Han)" and "_History of Han_ (_Hanshu_ 漢書)" depending on venue/language, and neither exists today.
- **Org/office labels are romanization-only.** Sinologists almost universally cite Hucker-style English translations for offices, and these translations are period-dependent (an office's English gloss changes across dynasties) — nothing in the data model represents that.

## Agreed design decisions (binding — do not re-litigate without Daniel reopening them)

1. **`work_type` ships before "belongs to."** It's cheap (one column, same shape as the existing `office_classifications`) and unlocks citation styling immediately. "Belongs to" (chapter → book) needs `entity_relations` wired up (currently dormant — round-trips via XML import/export in `xmlCodec.ts` but is never read into the panel summary) plus async cross-entity name resolution to render "chapter of X," which the current formatter isn't built for. Treated as a later, independent phase.
2. **Title convention (romanization-first vs. translation-first) lives in `EntityDisplaySpec`**, as a per-mention override with a project-level default per target language — same architecture as the existing `possessive`/`bracketsAround` fields, not a parallel system.
3. **Hucker translations stay local/opt-in, never shipped in the public Norbert asset pack.** Hucker's *Dictionary of Official Titles* is copyrighted; redistributing it verbatim is real legal exposure. Only **Huckbot5000** output — AI-inferred gap-fill translations, synthesized in Hucker's style from matched examples, not copied text — ships in the public pack, and even those must be source-tagged distinctly (`source: 'Huckbot5000'` vs `source: 'Hucker'`) using the existing origin/source/status convention already used throughout the entity store. CBDB's own terms of use may separately restrict redistributing *their* Hucker-derived fields — check before anything ships.
4. **Period-filtered office translations are variants on one entity, not duplicate entities.** "Same office name, different date range, different Hucker gloss" is modeled as N translation rows on a single office entity, each carrying a valid-from/valid-to range (reusing the existing `EntityDates` shape) — not separate entities sharing a name. Duplicate entities would break entity identity and complicate every `person_offices` reference (which one do you point at?).
5. **`work_type` taxonomy and citation styling (2026-08-05):** `book` (italic), `chapter` (quotes — covers chapters/articles), `poem` (quotes — individual poems; a poem *collection* is typed `book` and italicized), `painting` (italic, art-historical convention), `object` (plain, no styling). **Default is `book`:** unset/`NULL` is treated as book everywhere (display, panel summary, new-work inserts, schema migration7 backfill). Any single mapping can still be adjusted, but the enum and default styling rule are settled — this unblocks Phase 0.

## Open questions (need answers before building the phase they block)

These block their respective phase, not Phase 0:

- **Translation storage shape.** Leaning toward a new `entity_translations` table (same shape as `entity_names`: text/language/origin/source/status) rather than overloading `entity_names`, so translations don't pollute name-search/autocomplete matching. Not yet confirmed.
- **"TRANSLATION"/"TRADUCTION" prefill UX.** Daniel wants to nudge users to fill out empty translations. Risk flagged: literal insertable placeholder text risks shipping inside a real translation by accident (the translation pane is the one place a stray "TRADUCTION" could actually end up in output). Leaning toward a visually distinct empty-state affordance (dashed chip, "translate me") instead of typeable placeholder text — not decided.
- **"Whose date?" for period-filtered office translations.** An office mention in running prose doesn't always carry its own date. Candidates: the citing passage's date, the tagged office-holder's tenure, or falling back to "most recent variant" when no date is available. Needs a concrete rule before `renderEntityFromSpec` can take a date parameter.
- **Grand Ricci sourcing.** Daniel wants Grand Ricci title translations but has no known source/license path yet. Parked — not an engineering task until he has something to point at.

## Phased plan

### Phase 0 — `work_type` + citation styling — **SHIPPED (2026-08-05)**
**Goal:** a work entity knows what kind of thing it is, and the atomic field renders it correctly styled.
- New column on `works` (schema currently has zero work-specific columns beyond the FK) — same shape as `office_classifications`. Landed as `schema.ts` migration6 (`ENTITY_DB_SCHEMA_VERSION` bumped to 6), with a `CHECK` constraint on the five taxonomy values.
- Threaded through `assemblePanelSummary`/`getPanelSummary`/`listPanelSummaries` in `repository.ts` → `SqliteEntityPanelSummary.workType` → all three independent `EntitySummary` shapes (repository, `entityOps.ts` editor-panel, `entityFields/entitySummary.ts` translation-pane) → `EntitySummary.workType`, plus a new `repository.setWorkType()` + full IPC chain (`readService.ts`/`main.ts`/`preload.ts`) and renderer wrapper (`entityStore.ts` `sqliteSetWorkType`).
- Styling: `entityDisplay.ts` exports `workTypeStyle(entity)` (`'italic' | 'quote' | null`); `translationEntityFields.ts`'s `applyWorkTypeStyle` sets `data-work-style="italic"` (book/painting) or wraps the text in curly quotes (chapter/poem) on both `createEntityFieldElement` and `recalculateEntityFieldsInRoot`. A one-time `<style>` tag injected in `TranslationPane.tsx` (`ljb-entity-worktype-style`) turns the attribute into visible italics — presentation-only, as planned; semantic XML export (`<hi rend="italic">` on save) is still a follow-up, not done.
- Entity-editor UI: a `<TextField select>` in `SidebarDatabaseTab.tsx` next to the existing work-date editor, auto-saving on change via `saveWorkType`.
- XML-interchange path (`summarizeEntity` in `entityOps.ts`) returns `workType: null` always, as planned — not wired to XML round-trip.
- Tests: `repository.test.ts` (set/read round-trip incl. bulk `listPanelSummaries`, `CHECK`-constraint rejection), `translationEntityFields.test.ts` (italic/quote/neither per type, person immune, recalculate re-applies styling on a changed type) — 9 new tests, all passing alongside the existing suite (97 total). Both `tsc --noEmit` passes (desktop + cwrc-leafwriter) clean.

**Live-testing fixes (2026-08-05, same day):** Daniel's manual pass in the actual app surfaced three bugs in the entity-insertion machinery — none in the `work_type` logic itself, all in pre-existing `TranslationPane.tsx` code that the new feature happened to exercise for the first time via a `work`-kind insert:
1. **Invalid-XML-on-save.** `persist()` saved by doing `unit.innerHTML = clone.innerHTML` — serializing the editor's HTML to a string, then re-parsing that string as strict XML into the companion-file document. Chromium's XML `innerHTML` setter rejected it outright ("the provided markup is invalid XML"); jsdom couldn't reproduce this (its XML parser is more lenient), so the exact triggering construct was never pinned down precisely. Fixed by replacing the string round-trip with direct DOM node import (`doc.importNode`), which sidesteps the whole class of "valid HTML isn't guaranteed valid XML" failures rather than chasing the specific trigger. Also strips the presentation-only `data-work-style` attribute before saving (recomputed from the entity record on load, same as the other editing-only attributes already stripped there).
2. **Button-inserted entities landing at the start of the unit instead of the caret.** Root cause: the entity-insert toolbar button had no `onMouseDown={(e) => e.preventDefault()}` guard, unlike the (working) autocomplete suggestion list which already had one at `TranslationPane.tsx:3397` for the same reason — without it, clicking the button blurs the contentEditable and the browser drops the live text selection before the click handler runs.
3. **Same bug persisting after fix 2.** MUI's `<Menu>` auto-focuses its own content once opened (for keyboard nav) — independent of the button's mousedown, so the live selection was still lost between opening the menu and picking an entity. Fixed by calling the existing `rememberBodyRange()` at the top of `openEntityMenu`, snapshotting the caret the instant the button is clicked (before the button fix's preventDefault matters, and before the menu's own autofocus can steal it) — `insertEntityMention`'s existing `getEditableRange()` fallback already knew how to use a saved range, it just never had a fresh one to fall back to at the right moment.
4. **Same bug still persisting after fixes 2–3 (retest 2026-08-05 evening).** `insertEntityMention` did `await fetchEntitySummary(...)` and then `editable.focus()` *before* reading the saved range. Focusing a contentEditable invents a caret at the start of the unit; `getEditableRange()` then preferred that fresh (wrong) live selection and overwrote the range saved in step 3. Fixed by snapshotting `getEditableRange()` *before* the await, restoring that snapshot after the fetch, and adding `onMouseDown` preventDefault on the entity-picker `MenuItem`s so picking a result doesn't scramble focus either.

Confirmed fixed: #1 (no XML error). #2–#4 (correct placement) — deeper caret-snapshot fix applied; needs another retest.

**Italics require `work_type` (updated):** Citation styling defaults to **book** (italic) when `work_type` is unset. Schema migration7 backfills existing NULL rows to `'book'`; new works are created as book; the entity-editor dropdown no longer has an empty "—" option. Chapters/poems still get curly quotes; objects stay plain. Italics are applied both via the injected stylesheet and via the translation-pane MUI `sx` rule on `ref[data-work-style="italic"]`.

**Blank pane after leaving translation (2026-08-05 evening):** Leaving the translation tab calls `exitTranslationMode` (`active: false`), but `TranslationTabContent` kept its `resolvedKeyRef` so returning to the tab skipped `enterTranslationMode` — `TranslationPane` then rendered `null` into an empty portal. Fixed by clearing `resolvedKeyRef` when translation mode exits.

### Phase 1 — Title translations (storage, convention, display) — **PARTIAL (2026-08-05)**
**Goal:** a title can have an English/French translated form, shown in either display convention.
- **Shipped now (romanization-first only):** `entity_names` with `nameType: 'translation'` + language (already in the entity editor) is carried through `EntitySummary.names[].type`. First-occurrence display appends `(gloss)` after Chinese for the active translation-pane language: `_Jinshu_ 晉書 (Livre des Jin)`. Gloss is upright (not italic). Hideable via the entity-display popup chip.
- **Storage fix:** romanizations are a distinct `nameType: 'romanization'` with a `*-Latn` language tag (schema migration 8 + `setRomanizedName` / auto-clean). Vernacular title glosses remain `translation`. Display still tolerates legacy mis-tagged rows.
- Still open / not built: separate `entity_translations` table (vs overloading names), translation-first convention toggle on `EntityDisplaySpec`, project-level default per target language, Wikidata pull (Phase 1b).
- **Depends on:** Phase 0 landing first is not required, but sharing the same "new part on `EntitySummary`" pattern makes this easier once Phase 0's plumbing (repository → panel summary → `EntitySummary` → `entityDisplay.ts`) is fresh/proven.
- Wikidata pull (translated labels, CC0, no licensing concern unlike Hucker) is a natural Phase 1b — separate PR, not blocking core display.

### Phase 2 — "TRANSLATION"/"TRADUCTION" empty-state nudge
**Goal:** encourage users to fill out missing translations without risking stray placeholder text shipping in real output.
- Depends on Phase 1's UI existing to prototype against.
- Blocked on the UX decision above.

### Phase 3 — Org/role period-filtered translations (Hucker data model)
**Goal:** office/org labels carry period-appropriate English glosses.
- Extends Phase 1's translation table with valid-from/valid-to columns (or a variant sub-table) — same shape as `EntityDates`.
- New "applicable date" input threaded into `renderEntityFromSpec` (today only takes entity + occurrence + spec + lang).
- Blocked on the "whose date?" decision above.
- **Depends on Phase 1's translation infrastructure existing** — this is Phase 1 plus date-ranging, not a separate system.

### Phase 4 — Huckbot5000 pipeline
**Goal:** asset-pack build step that matches Hucker/Grand-Ricci-if-obtainable translations to Norbert/CBDB office entities by string+period, then feeds the untranslated remainder to an AI to infer translations in Hucker's style, source-tagged as `Huckbot5000`.
- **Depends on Phase 3's schema existing** (needs the target shape to populate).
- Not an in-app feature — an asset-pack build tool, separate codebase area from the live app.
- Also gated on Daniel having Hucker data digitized/matched at all.

### Parked, not phase-ordered
- **"Belongs to" (chapter → book) hierarchy.** Independent of Phases 1–4; can slot in whenever richer bibliography is wanted, once `entity_relations` reading + cross-entity name resolution is designed.
- **Grand Ricci sourcing.** Waiting on Daniel.

## Sequencing

- **Phase 0** has no open dependencies and is ready to plan/build now.
- **Phase 1** is the next real build — bigger than Phase 0 (new table, new UI, new convention logic) but not blocked by anything except its own open question (storage shape).
- **Phase 2** depends on Phase 1's UI.
- **Phase 3** depends on Phase 1's infrastructure and its own open question ("whose date?").
- **Phase 4** depends on Phase 3's schema and is lowest priority — a build-tool project, not an in-app feature.
- **"Belongs to"** and **Grand Ricci** run on their own track, not gating or gated by 0–4.
