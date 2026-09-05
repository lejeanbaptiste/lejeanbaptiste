# Entity display: work types, title translations, period-filtered role translations

**Status (2026-08-06 / updated 2026-08-07):** **Phases 0–3, 1b shipped.** `work_type`; `entity_translations` + title convention; empty-state translation nudge; Wikidata batch backfill widened to all project translation languages; and Phase 3 (office entities can now carry a period date range, shown on candidates during disambiguation). **Office display follow-up (2026-08-07):** when an office has a vernacular gloss, the default recipe is translation-only (no pinyin/characters); extras remain available via the entity-display popup. Offices also accept en/fr gloss fallback when the exact pane language is missing (other kinds stay language-exact). AI translation blinding/retry is documented in `translation-smoke-tests.md` §10. Remaining: Phase 4 (Huckbot5000), "belongs to" hierarchy, Grand Ricci sourcing — all parked/lower priority, see below.

## Context

The kind-aware formatter fixed the mechanical problem (place/org/office/work no longer get a person-shaped family/given split), but left real content gaps:

- **Titles (`work` kind)** have no type. We can't italicize a book, quote a chapter, or leave a painting unstyled, because nothing records which one it is.
- **Titles have no translation.** Scholarly convention needs both "_Hanshu_ 漢書 (History of Han)" and "_History of Han_ (_Hanshu_ 漢書)" depending on venue/language, and neither exists today.
- **Org/office labels are romanization-only.** Sinologists almost universally cite Hucker-style English translations for offices, and these translations are period-dependent (an office's English gloss changes across dynasties) — nothing in the data model represents that.

## Agreed design decisions (binding — do not re-litigate without Daniel reopening them)

1. **`work_type` ships before "belongs to."** It's cheap (one column, same shape as the existing `office_classifications`) and unlocks citation styling immediately. "Belongs to" (chapter → book) needs `entity_relations` wired up (currently dormant — round-trips via XML import/export in `xmlCodec.ts` but is never read into the panel summary) plus async cross-entity name resolution to render "chapter of X," which the current formatter isn't built for. Treated as a later, independent phase.
2. **Title convention (romanization-first vs. translation-first) lives in `EntityDisplaySpec`**, as a per-mention override with a project-level default per target language — same architecture as the existing `possessive`/`bracketsAround` fields, not a parallel system.
3. **Hucker dictionary prose is not redistributed in public asset packs.** Hucker's _Dictionary
   of Official Titles_ remains under copyright. Our publishable packs therefore omit verbatim
   Hucker text and omit CBDB fields that cite `(Hucker)`. Where an office still needs an English
   gloss in our packs, gap-fill candidates may ship only as **Huckbot5000** output — reviewed
   translations that do not match known Hucker wording, source-tagged `source: 'Huckbot5000'` so
   they are never confused with Hucker's own scholarship (`source: 'Hucker'`). Candidates that
   match known Hucker wording are excluded from publishable packs and kept only in a local
   collision archive for audit. Separately, users who install CBDB's official database may see
   whatever CBDB itself publishes; that is CBDB's distribution, not ours. Confirm CBDB's terms
   before any pack release that might still carry contested fields.
4. **~~Period-filtered office translations are variants on one entity, not duplicate entities~~ — SUPERSEDED (2026-08-06).** Revised: **a `roleName`/office entity is defined as string + translation + date range.** Daniel has been implicitly working this way already — CBDB itself disambiguates by period (its office codes are already period-specific), and Norbert only covers Han/Six Dynasties, so "which era" is already baked into which authority/candidate a tagger picks. Each period-specific office is its own entity (matching CBDB's own granularity, not an artificial leaf-writer split), disambiguated at tagging time via the existing candidate-picker UI — not a new "translation variant" concept layered on top of one shared entity. This resolves the "whose date?" open question below by eliminating it: see there for why.
5. **`work_type` taxonomy and citation styling (2026-08-05):** `book` (italic), `chapter` (quotes — covers chapters/articles), `poem` (quotes — individual poems; a poem _collection_ is typed `book` and italicized), `painting` (italic, art-historical convention), `object` (plain, no styling). **Default is `book`:** unset/`NULL` is treated as book everywhere (display, panel summary, new-work inserts, schema migration7 backfill). Any single mapping can still be adjusted, but the enum and default styling rule are settled — this unblocks Phase 0.

## Open questions (need answers before building the phase they block)

These block their respective phase, not Phase 0:

- ~~**Translation storage shape.**~~ **Decided (2026-08-06):** dedicated `entity_translations` table (schema migration 9). Same origin/source/status conventions as names; glosses are out of name-search/autocomplete; the editor still merges them into the names list as `nameType: 'translation'`.
- ~~**"TRANSLATION"/"TRADUCTION" prefill UX.**~~ **Decided (2026-08-06):** dashed non-typeable affordance on both the entity editor and the translation-pane display popup — never insert literal placeholder text into the document or entity store.
- ~~**"Whose date?" for period-filtered office translations.**~~ **Resolved (2026-08-06) by elimination, not by picking a rule.** Given decision #4's revision, this question doesn't need an answer: `renderEntityFromSpec` never needs a date parameter, because there's nothing to disambiguate at render time. A `roleName` mention is either tagged with a resolved `key` pointing at one specific, already-period-disambiguated office entity, or it isn't tagged at all yet (plain text, same as any other unresolved person/place mention today) — `collectSourceUnitEntities`/the AI-translation entity list only ever pick up mentions with a resolved key, so an ambiguous mention simply never reaches rendering or the AI-translation placeholder pipeline. The disambiguation moment is pushed entirely upstream, to the existing entity-tagging/candidate-picker UI, at the point a `roleName` span gets linked to a specific CBDB/Norbert office record in the first place.
- **Grand Ricci sourcing.** Daniel wants Grand Ricci title translations but has no known source/license path yet. Parked — not an engineering task until he has something to point at.

## Phased plan

### Phase 0 — `work_type` + citation styling — **SHIPPED (2026-08-05)**

**Goal:** a work entity knows what kind of thing it is, and the atomic field renders it correctly styled.

- New column on `works` (schema currently has zero work-specific columns beyond the FK) — same shape as `office_classifications`. Landed as `schema.ts` migration6 (`ENTITY_DB_SCHEMA_VERSION` bumped to 6), with a `CHECK` constraint on the five taxonomy values.
- Threaded through `assemblePanelSummary`/`getPanelSummary`/`listPanelSummaries` in `repository.ts` → `SqliteEntityPanelSummary.workType` → all three independent `EntitySummary` shapes (repository, `entityOps.ts` editor-panel, `entityFields/entitySummary.ts` translation-pane) → `EntitySummary.workType`, plus a new `repository.setWorkType()` + full IPC chain (`readService.ts`/`main.ts`/`preload.ts`) and renderer wrapper (`entityStore.ts` `sqliteSetWorkType`).
- Styling: `entityDisplay.ts` exports `workTypeStyle(entity)` (`'italic' | 'quote' | null`); `translationEntityFields.ts`'s `applyWorkTypeStyle` sets `data-work-style="italic"` (book/painting) or wraps the text in curly quotes (chapter/poem) on both `createEntityFieldElement` and `recalculateEntityFieldsInRoot`. A one-time `<style>` tag injected in `TranslationPane.tsx` (`grognard-entity-worktype-style`) turns the attribute into visible italics — presentation-only, as planned; semantic XML export (`<hi rend="italic">` on save) is still a follow-up, not done.
- Entity-editor UI: a `<TextField select>` in `SidebarDatabaseTab.tsx` next to the existing work-date editor, auto-saving on change via `saveWorkType`.
- XML-interchange path (`summarizeEntity` in `entityOps.ts`) returns `workType: null` always, as planned — not wired to XML round-trip.
- Tests: `repository.test.ts` (set/read round-trip incl. bulk `listPanelSummaries`, `CHECK`-constraint rejection), `translationEntityFields.test.ts` (italic/quote/neither per type, person immune, recalculate re-applies styling on a changed type) — 9 new tests, all passing alongside the existing suite (97 total). Both `tsc --noEmit` passes (desktop + cwrc-leafwriter) clean.

**Live-testing fixes (2026-08-05, same day):** Daniel's manual pass in the actual app surfaced three bugs in the entity-insertion machinery — none in the `work_type` logic itself, all in pre-existing `TranslationPane.tsx` code that the new feature happened to exercise for the first time via a `work`-kind insert:

1. **Invalid-XML-on-save.** `persist()` saved by doing `unit.innerHTML = clone.innerHTML` — serializing the editor's HTML to a string, then re-parsing that string as strict XML into the companion-file document. Chromium's XML `innerHTML` setter rejected it outright ("the provided markup is invalid XML"); jsdom couldn't reproduce this (its XML parser is more lenient), so the exact triggering construct was never pinned down precisely. Fixed by replacing the string round-trip with direct DOM node import (`doc.importNode`), which sidesteps the whole class of "valid HTML isn't guaranteed valid XML" failures rather than chasing the specific trigger. Also strips the presentation-only `data-work-style` attribute before saving (recomputed from the entity record on load, same as the other editing-only attributes already stripped there).
2. **Button-inserted entities landing at the start of the unit instead of the caret.** Root cause: the entity-insert toolbar button had no `onMouseDown={(e) => e.preventDefault()}` guard, unlike the (working) autocomplete suggestion list which already had one at `TranslationPane.tsx:3397` for the same reason — without it, clicking the button blurs the contentEditable and the browser drops the live text selection before the click handler runs.
3. **Same bug persisting after fix 2.** MUI's `<Menu>` auto-focuses its own content once opened (for keyboard nav) — independent of the button's mousedown, so the live selection was still lost between opening the menu and picking an entity. Fixed by calling the existing `rememberBodyRange()` at the top of `openEntityMenu`, snapshotting the caret the instant the button is clicked (before the button fix's preventDefault matters, and before the menu's own autofocus can steal it) — `insertEntityMention`'s existing `getEditableRange()` fallback already knew how to use a saved range, it just never had a fresh one to fall back to at the right moment.
4. **Same bug still persisting after fixes 2–3 (retest 2026-08-05 evening).** `insertEntityMention` did `await fetchEntitySummary(...)` and then `editable.focus()` _before_ reading the saved range. Focusing a contentEditable invents a caret at the start of the unit; `getEditableRange()` then preferred that fresh (wrong) live selection and overwrote the range saved in step 3. Fixed by snapshotting `getEditableRange()` _before_ the await, restoring that snapshot after the fetch, and adding `onMouseDown` preventDefault on the entity-picker `MenuItem`s so picking a result doesn't scramble focus either.

Confirmed fixed: #1 (no XML error). #2–#4 (correct placement) — deeper caret-snapshot fix applied; needs another retest.

**Italics require `work_type` (updated):** Citation styling defaults to **book** (italic) when `work_type` is unset. Schema migration7 backfills existing NULL rows to `'book'`; new works are created as book; the entity-editor dropdown no longer has an empty "—" option. Chapters/poems still get curly quotes; objects stay plain. Italics are applied both via the injected stylesheet and via the translation-pane MUI `sx` rule on `ref[data-work-style="italic"]`.

**Blank pane after leaving translation (2026-08-05 evening):** Leaving the translation tab calls `exitTranslationMode` (`active: false`), but `TranslationTabContent` kept its `resolvedKeyRef` so returning to the tab skipped `enterTranslationMode` — `TranslationPane` then rendered `null` into an empty portal. Fixed by clearing `resolvedKeyRef` when translation mode exits.

### Phase 1 — Title translations (storage, convention, display) — **SHIPPED (2026-08-06)**

**Goal:** a title can have an English/French translated form, shown in either display convention.

- **Display:** First-occurrence can be romanization-first (`_Jinshu_ 晉書 (Livre des Jin)`) or translation-first (`_Livre des Jin_ (Jinshu 晉書)`). Gloss / leading title italics follow the convention. Hideable via the entity-display popup chip; “Lead with translation” switch writes an explicit per-mention override.
- **Storage:** vernacular glosses live in `entity_translations` (schema migration 9). Romanizations stay in `entity_names` as `nameType: 'romanization'` + `*-Latn` (migration 8). Editor UI still edits glosses as Translation name rows; repository routes those writes to the translations table. Display prefers `EntitySummary.translations`, with a dual-read fallback for any leftover `nameType: 'translation'` name rows.
- **Language default:** personal translation-policy setting (`titleConvention` per en/fr/de bucket in localStorage), same store as date wording — not edition/project XML. Default remains romanization-first.

### Phase 1b — Widen the Wikidata batch backfill — **SHIPPED (2026-08-06)**

**Goal:** the existing bulk Wikidata pull (Database Window refresh) should cover every language the project has configured for translation, not just `en` + the desktop UI language.

- Scope decision: widen the existing batch job (`backfillEntitiesSqlite`), not a new per-entity "Suggest from Wikidata" button — that on-demand pattern already exists for AI (`suggestEntityGloss`) and wasn't duplicated for Wikidata.
- `fetchWikidataWorkDetails` (`wikidataWorkDetails.ts`) gained a 4th param, `extraLanguages?: string[]`, unioned into the requested/extracted label-language set alongside `en` + `desktopLanguage` — additive, no existing caller or test needed to change.
- `backfillEntitiesSqlite` (`sqliteAuthorityBackfill.ts`) gained a `translationLanguages?: string[]` option, forwarded to both of its internal `fetchWikidataWorkDetails` call sites (the person `expandWikidataWorks` branch and the direct work-entity path).
- `DatabaseWindow.tsx` now reads the project's configured translation languages the same way the entity editor's nudge chips do (`getActiveProjectBundle()` + `readTranslationSettings()`), and passes them into the bulk-refresh call.
- **Bonus fix, same pass:** `DatabaseWindow.tsx` was never passing `desktopLanguage` to the backfill at all, so in practice the bulk job only ever fetched the `en` label regardless of UI language — now passes `i18n.language`.
- Tests: `wikidataWorkDetails.test.ts` — 3 new cases (extra languages included when present, an entity missing one language's label is skipped rather than erroring, and a regression case confirming default `en`+`desktopLanguage`-only behavior is unchanged when the new param is omitted). `backfillEntitiesSqlite` itself has no unit tests (none existed before this change either — flagged as a coverage gap, not silently skipped); relying on TypeScript plus the direct test of the function whose logic actually changed.
- Not yet done: a live pass of the Database Window's bulk refresh against a real project with 2+ translation languages configured and a Wikidata-linked work — network + Electron, not something driveable headlessly from here.

### Phase 2 — "TRANSLATION"/"TRADUCTION" empty-state nudge — **SHIPPED (2026-08-06)**

**Goal:** encourage users to fill out missing translations without risking stray placeholder text shipping in real output.

- **Entity editor:** dashed chips under the names/titles list for each configured project translation language that lacks a gloss; click prefills Add as type Translation + that language and focuses the text field.
- **Translation pane:** dashed “Add translation…” chip in the entity-display popup when the pane language has no gloss; opens a dialog that saves via `sqliteAddName` → `entity_translations`, then refreshes the mention.
- No literal “TRANSLATION”/“TRADUCTION” text is ever written into the document or the entity store.
- **AI suggest on nudge (2026-08-06):** “Suggest with AI” on both surfaces fills the draft gloss only (popup dialog + editor Add row when type is Translation and a language is set). User still edits and clicks Save/Add. Gated by `entityGlossSuggest` (on by default); separate from unfinished full-unit `translationGenerate`.

### Phase 3 — Org/role period-filtered translations (Hucker data model) — **SHIPPED (2026-08-06)**

**Goal:** office/role labels carry period-appropriate English glosses.
Per decision #4's revision, this phase turned out much smaller than originally sketched — no new "variant" concept, no date parameter threaded through the formatter. A `roleName` entity is string + translation + date range, full stop; each period-specific office is its own entity, same as any other entity kind.

- **Backend generalization** (`apps/desktop/src/entityDbSqlite/repository.ts`, `assemblePanelSummary`): the precision-carrying `workDate` object — previously built only for `kind === 'work'` — now builds for _any_ kind when no birth/death row exists and a generic `entity_dates` row does. Purely additive; the pre-existing `startYear`/`endYear` fallback computation (from Part 2) is untouched. This is also why the earlier Part 2 test asserting a bare-dates org got `workDate: null` had to be updated — that org now correctly gets a populated `workDate` too, since the generalization isn't office-specific, it's kind-agnostic by design.
- **Entity editor** (`SidebarDatabaseTab.tsx`): the date-range form (previously person/work only) is now offered for `office` entities too — same `setUserWorkDate`/`sqliteSetUserWorkDate` call, no new IPC needed since it was already kind-agnostic under the hood. The work-authors sub-section (irrelevant to office) stays scoped to `work` only within that same block.
- **Candidate picker** (`packages/cwrc-leafwriter/src/autoTagging/DisambiguationPanel.tsx`): candidate rows now show a period caption (`startYear`–`endYear`, or `dynasty` when years are absent) whenever present — `formatCandidatePeriod()`, kind-agnostic, reusing `DisambiguationCandidate.startYear`/`endYear`/`dynasty` fields that already existed on the type and were already populated from authority-pack metadata with no kind gate, just never rendered. This is the actual disambiguation UI: a user tagging a `roleName` span against CBDB/Norbert candidates from different eras can now see which era each candidate belongs to before picking.
- No changes needed to `entityDisplay.ts`/`renderEntityFromSpec`/`EntityDisplaySpec` — a resolved office mention renders exactly like any other Phase 1 title translation already does.
- Tests: 3 new in `repository.test.ts` (office `workDate` populated with precision; place/org with zero dates still get `null`; a birth/death row takes precedence over the generic dates row for `workDate`, matching the existing `startYear`/`endYear` precedence) — 41 total passing. Both `tsc --noEmit` clean (desktop, commons; cwrc-leafwriter has only the two pre-existing unrelated errors already flagged in earlier phases).
- **Not verified, flagged as a live-check item, not blocking:** whether the actual installed `cbdb-offices.ndjson`/`norbert-offices.ndjson` authority packs populate `metadata.startYear/endYear/dynasty` for office rows in practice — the code fully supports it and the schema documents it, but no live pack file was available in this checkout to confirm. `SidebarDatabaseTab.tsx`/`DisambiguationPanel.tsx` are deep Electron UI with live SQLite/authority-pack state, not headlessly testable — worth a manual pass opening an office entity's date form and running disambiguation on a multi-era `roleName` span.

### Phase 4 — Huckbot5000 pipeline

**Goal:** asset-pack build step that generates English office-title glosses for CBDB/Norbert
offices that still lack a publishable translation, filters candidates that match known Hucker
wording, and ships only reviewed rows source-tagged as `Huckbot5000`. (Grand Ricci, if a
clear license path appears later, is a separate sourcing track.)

- **Depends on Phase 3's schema existing** (needs the target shape to populate).
- Not an in-app feature — an asset-pack build tool, separate codebase area from the live app.
- Also gated on Daniel having Hucker data digitized/matched at all.

### Parked, not phase-ordered

- **"Belongs to" (chapter → book) hierarchy.** Independent of Phases 1–4; can slot in whenever richer bibliography is wanted, once `entity_relations` reading + cross-entity name resolution is designed.
- **Grand Ricci sourcing.** Waiting on Daniel.

## Sequencing

- **Phases 0–3 and 1b** are shipped.
- **Phase 4** depends on Phase 3 (needs office entities with real date ranges to match against — now in place) and is lowest priority — a build-tool project, not an in-app feature. See also `project_huckbot5000_feasibility` memory (actively being updated as of 2026-08-06: lexicon extractable, composition rules aren't, OCR cleaned, CBDB `(Hucker)`-cited fields in published packs being audited) — read it before scoping Phase 4's approach.
- **"Belongs to"** and **Grand Ricci** run on their own track, not gating or gated by 0–4.
