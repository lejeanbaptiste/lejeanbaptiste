# Auto-tagging & Disambiguation — Work Phases

Companion to [Auto-tagging.md](Auto-tagging.md). Each phase lists what must be **decided** or **prepared** before starting, and what "done" looks like. Phases are ordered so that every later phase only produces or consumes suggestion objects — the machinery from Phases 0–1 is never rebuilt.

## Phase 0 — Foundations: suggestion object, anchoring, apply engine

The invisible layer everything else sits on. No user-facing feature yet.

**Decide first:**
- [x] Final schema of the suggestion object (fields, action vocabulary, status vocabulary) — freeze it, since every method will emit it. **DPM:** OK for Claude's suggestion in [Auto-tagging](Auto-tagging).
- [x] Anchor verification policy: exact-match only, or tolerate whitespace/normalization differences? What normalization (Unicode NFC?) is applied before matching? **DPM:** tolerate whitespace and normalisation, NFC.
- [x] Temporary-id scheme for in-session anchoring: attribute name, id format, and the guarantee that they are flushed on session end / never serialized to disk. **DPM:** agreed, we just need to make sure that it is compatible with different schemata.
- [x] Where suggestion batches live while pending (memory only, or persisted so a review can be resumed?). **DPM:** maybe a hidden cache folder to be emptied after so many days.. 
- [x] Undo integration: how does a batch apply register as one step in the editor's existing undo stack? **DPM:** can't we take a time machine snapshot before and revert if the user doesn't like it?

**Prepare:**
- [x] Audit sanmiao's regex/xpath/validation functions; list what ports to TypeScript, what gets rewritten. DPM: see ~/Code/sanmiao/src/sanmiao/tagging.py.
- [x] Inventory the schema-rule needs: which tag-inside-tag combinations must be blocked/cleaned (e.g. `<date>` in `<placeName>`), and whether these derive from the project schema automatically or from a hand-written ruleset. **Decided:** two layers. (1) Structural validity comes from the loaded schema automatically via the existing `schemaManager` (`isTagValidChildOfParent`, ancestor-chain check before insertion) — no hand-maintained inventory; full validation after apply catches rare positional cases the tag-level check misses. (2) User taste rules (schema-allowed but unwanted, e.g. `<date>` in `<placeName>`) in a settings panel: structured form `{ tag, notInside }` with dropdowns from the schema, optional raw-XPath escape hatch. Rules block during auto-tagging, warn during audit. Ships empty; a few of DPM's own rules serve as test fixtures.
- [x] Test corpus: a handful of real project documents, including at least one that is messy (mixed content, existing nested tags) for the dedup/validation path.

**Done when:** given a hand-written list of suggestion objects, the engine applies them to a document — insert into text nodes, dedup, schema check before insertion, validate — as a single undo step, and refuses (marks unresolvable) any suggestion whose anchor doesn't verify.

**Status (2026-07-03):** built at `packages/cwrc-leafwriter/src/autoTagging/` (types, normalize, anchor, apply; tests colocated, run against `test_project/sizhu_shang.xml`). Anchoring (3-tier resolution, document-stream context) and apply (dedup, schema callback, user rules, longest-span-first, snapshot revert) done. Still to wire when the UI lands: hook `canContain` to the live `schemaManager`, run the validator package after apply, register snapshot revert with the editor.

## Phase 1 — Shared review UI

The commit gate for all methods.

**Decide first:**
- [x] Layout: split-screen (editor + to-do list) vs. panel; how it coexists with the existing panel system. **DPM:** Let's start with a big panel to the right, left panel closed, to experiment. 
- [x] Keyboard model: keys for accept / reject / next / prev / jump-to-instance (mirror find-and-replace conventions). DPM: yes.
- [x] Granularity of accept: per item only, or also "accept all from this source above confidence X"? **DPM:** not bad, but we're maybe not always going to be running AI, so maybe the confidence button should only appear when that has been activated.
- [x] What happens to rejected suggestions — discarded, or logged for the decision log (Phase 3)? **DPM:** Maybe we should log them for 'training data' in ranking candidates.
- [x] Whether partial application is allowed (accept 40 of 200, apply, keep reviewing) or review completes before apply. DPM: I would say one at a time, all, or maybe 'within selection'.

**Prepare:**
- [x] UI mock of the to-do item: tag, surface, rationale, confidence, action buttons — realized directly in `ReviewPanel`.
- [x] A fake suggestion generator for development (`fakeSuggestions.ts`).

**Done when:** a batch of (fake) suggestions can be walked, filtered by confidence/source, accepted/rejected with keyboard only, and applied as one undo step.

**Status (2026-07-03):** built at `packages/cwrc-leafwriter/src/autoTagging/`: `reviewController.ts` (framework-free walk state machine: cursor, decisions, filters by source/confidence, wrap-around advance, revocable decisions, partial apply via `takeAccepted()`), `ReviewPanel.tsx` (React/MUI to-do list wired to the controller; keyboard j/↓ k/↑ a/Enter r/x u), `fakeSuggestions.ts`. Tests cover a keyboard-only walk through apply into a real document. Per DPM's answers: rejections are kept and emitted via `onDecision` for the future decision log; bulk accept exists as `acceptAllAbove(confidence)` — the UI button for it should only appear when an AI source is present in the batch; "apply within selection" noted as a future apply mode. Remaining: mount as a big right panel (left closed) in the editor layout, connect `onFocus` → `utilities.selectElementById` and apply → editor snapshot/undo — lands with the Phase 2 popup shell.

## Phase 2 — Dictionary tagging & East Asian dates

First real producers. Should be small once 0–1 exist.

**Decide first:**
- [x] Import formats for v1 (tsv/csv/xlsx — which spreadsheet formats exactly, and which library reads them). **DPM:** also LibreOffice. 
- [x] Table schema beyond string/tag: allow an optional attributes column? An optional entity-id column (forward-compatible with Phase 3)? **DPM:** yes, allow.
- [x] Internal-crawl scope: crawl current document, open documents, or whole project? Where is the compiled list stored and is it user-editable?  DPM: Current or open. The user selects the compiled list from somewhere on his computer.
- [ ] For dates: exactly which sanmiao capabilities are in scope for v1, and what TEI output (`<date when=…>`? `@when-custom`? calendar attributes?). **DPM:** we'll implement this later.
- [x] Matching policy details: longest-string-first is decided; also decide case/width sensitivity and whether matches can cross existing tag boundaries. **DPM:** longest string first; fuzzy is good, if it's not too complicated; no cross tag boundaries.

**Prepare:**
- [ ] Port/adapt the sanmiao date logic; write its TEI mapping table.
- [ ] Sample dictionary tables from real data (including strings that overlap, to exercise conflict resolution rule 1). **DPM:** I extracted 5000 person names from CBDB in sample_names.csv.
- [ ] The big-popup entry point on the central panel (method chooser shell — AI/NER greyed out).

**Done when:** import a spreadsheet → suggestions → review walk → tagged, validated document. Date tagging same path.

**Status (2026-07-03):** integration built. **Apply-target decision:** apply operates on the XML source (fetched via `converter.getDocumentContent(false)`, mutated by the apply engine, reloaded via `writer.loadDocumentXML`) — the same round-trip the source editor uses; the pre-apply XML string is the snapshot, "Revert last apply" reloads it. New pieces: `autoTagging/dictionary.ts` (CSV/TSV table parser — header row optional, quoted fields, optional attributes/entityId columns with entityId → `@key`; producer with longest-first span claiming, no cross-tag matches), `autoTagging/integration.ts` (`AutoTaggingSession`: getDocument/apply/revert/focus against a live Writer; `canContain` wired to `schemaManager.isTagValidChildOfParent`; focus locates the surface by occurrence in the editor body and sets the TinyMCE selection), `dialogs/autoTagging/` (method-chooser dialog: Dictionary live, dates/AI/NER greyed out; hosts `ReviewPanel`), toolbar button (TagPlus icon) → `openDialog({ type: 'autoTagging' })`. xlsx/ods import and the sanmiao date producer still pending; validation after apply fires via `writer.validate()`.

**Fixes after first live test (2026-07-03):** (1) `ReviewPanel` keyboard handler lived on an unfocused `<div>` inside the MUI dialog, so nothing could be accepted and Apply stayed disabled — now the container auto-focuses on batch mount, and each pending row has explicit Accept/Reject icon buttons (decided rows show Undo) so review no longer depends on keyboard alone. (2) Single-character dictionary entries (bare CJK surnames like 王/陳/劉) match far too broadly in running text; the import now drops strings of length ≤ 1 and reports the count.

**Phase 2 polish (2026-07-03):** xlsx/LibreOffice import and internal crawl done.
- **Spreadsheet import** (`autoTagging/spreadsheet.ts`): reads xlsx and ods via JSZip (already in the tree; added as a direct dep of cwrc-leafwriter) + the DOM — no SheetJS/CVE dependency. Handles shared strings, inline strings, sparse cells (xlsx) and repeated-cell padding (ods). Dictionary column-mapping was refactored into `entriesFromRows(string[][])` so CSV/TSV and spreadsheets share one path. Dialog file input now accepts `.csv,.tsv,.txt,.xlsx,.xlsm,.ods`.
- **Internal crawl** (`autoTagging/crawl.ts`, `integration.ts`): `crawlEntities(doc, policy, tags?)` compiles a dictionary from entities already tagged in one document; `crawlDocuments(docs, …)` merges across several. Default TEI entity tag set; surfaces normalized with the whitespace policy. Tag stage only — no `@key`/`@ref` propagation (identity is Phase 4b). Dialog method **"From existing tags in this project"**: on desktop, `getProjectDocuments()` reads every project XML via `listProjectXmlFiles` (skipping the active file on disk — the live editor copy is used instead) and applies matches to the **current** document only. Web app / no project open falls back to the current document with `available: false`.
- **Producer dedup moved earlier**: `dictionaryTag` now skips matches already inside the target tag (ancestor check), so the review list no longer shows no-op items; apply-time dedup remains as a safety net. 119 tests pass.
- There should be NO disambiguation or id-ing at this stage.

## Phase 3 — Entity file & decision log

The disambiguation substrate. No UI beyond what's needed to create the file.

**Decide first:**
- [x] Exact TEI shape: TEI standoff `entities.xml`. V1 includes `<listPerson>`, `<listPlace>`, `<listOrg>`, and `<listBibl>`, and must allow additional project-defined lists for tags the user adds and wants to disambiguate.
- [x] **Scope (2026-07-04):** one **central** entity database per user (default), opt-in **project-local** `entities.xml`. Central **folder** chosen at install/first-run with explanation (stores database; suggest keeping projects there); `{folder}/entities.xml`. Changeable in App Settings (pointer-only + warning on move). No directory walking.
- [x] **Visibility & branding (2026-07-04):** `entities.xml` visible (central or project-local). LJB-internal clutter in hidden **`.ljb/`** per project. No LEAF/`.leaf` branding. Provenance: `#ljb-autotag`, `resp="le-jean-baptiste"`.
- [x] **Project settings UI (2026-07-04):** rename **Edition metadata → Project settings** (menu, dialog, locales). Include entity database choice: central vs project-specific. On project open, if project JSON lacks `entityStore`, open Project settings automatically.
- [x] **Database identity (2026-07-04):** UUID in `entities.xml` header (`idno type="ljb-entity-database"`); project JSON stores `entityDatabaseId`. Mismatch on open → warn ids won't match. Scaffold marker + hard-coded editor check before any entity read/write (reject non-database TEI files).
- [x] **Missing database (2026-07-04):** warn prominently; offer find existing OR create new; emphasize backup. If corpus has `@key` but DB lost: **purge all ids** OR **reconstitute stubs from corpus** (preserves id strings, loses authority metadata).
- [x] **Voluntary switch (2026-07-04, revised):** on database mismatch, offer **Cancel** | **Import from previous database** (copy entity records + all `<idno>` authority links into target with fresh local ids; dedupe on matching authority `<idno>`; remap corpus `@key` values) | **Purge** (`@key` only). LJB local ids are discarded; authority links and mention groupings preserved. Reconstitute only when old file is lost.
- [x] **Purge semantics (2026-07-04):** strip `@key` only — keep tags, `@resp`, `cert`, and all other attributes.
- [x] **External edits (2026-07-04):** file watcher → "Database changed externally — reload?"
- [x] **Time Machine (2026-07-04):** add tab/scope for central entity database backups (project snapshots stay under `.ljb/`).
- [x] Local id scheme: typed sequential `xml:id`s (`person-000001`, `place-000001`, `org-000001`, `work-000001`, etc.). Generation scans existing ids for the type, takes the next suffix, and increments on collision. Do not derive ids from names.
- [x] Mentions use `@key`, not `@ref`, with a bare local id: `<persName key="person-000001">張衡</persName>`. The project entity file location is resolved by project metadata/default convention, not encoded into each mention.
- [x] Recognized `<idno>` types: canonical `CBDB`, `Wikidata`, `VIAF`, `DILA`, `CHGIS`, and `GeoNames` (places). Cached authority display data is optional compact JSON in `<note type="authority-cache" source="..." resp="le-jean-baptiste" when="...">`; `<idno>` values remain the source of truth.
- [x] Decision log: append-only JSONL at `<projectRoot>/.ljb/entity-decisions.jsonl`. Per-project only. Other `.ljb/` contents: pending caches, import logs, project Time Machine snapshots.
- [x] **Exclusion mechanism**: reserve `/.ljb/`; exclude project-local `entities.xml` from corpus scans. Central `entities.xml` is outside project tree.
- [x] **Incremental ids**: `nextEntityId()` scans highest suffix per type, +1, collision-safe — SQL auto-increment equivalent within one database file (see `Auto-tagging.md`).
- [x] **Candidate / unresolved representation** (decided in place of Norbert's in-document `|` lists): the corpus XML holds only *terminal* states — (1) resolved: `key="person-000001"` (single local id); (2) deferred/ambiguous: TEI-native `cert="unknown"` marker with no key, styled red in the editor as a deliberate irritant (the equivalent of Norbert's red 'ambiguous' tag); (3) not-an-entity: tag removed. **Candidate sets** for unresolved strings are persisted in `.ljb/` (not in corpus XML) so the user can return without re-seeding — updated 2026-07-04 per DPM. Provenance: machine-auto-resolved mentions carry `resp="#ljb-autotag"` (or `cert="high"`) to distinguish confident auto-links from human-confirmed ones. Entities are written to `entities.xml` only when resolved or auto-resolved (unique hit) — never speculative candidates, so every entity in the file is real and referenced.

**Prepare:**
- [ ] Survey existing TEI personography conventions/tools for interop before inventing anything. *(Not done as a formal tool survey. Shape is standard: `<standOff>`/`<listPerson>`+`<listPlace>`+`<listOrg>` with `<person xml:id>`, names in `<persName>`, authority links as `<idno type="VIAF|Wikidata|CBDB">`; interop tools (CETEIcean, TEI Publisher) expect this. Chosen model uses `@key` with bare local id — confirm target tools accept `@key` vs `@ref` before locking.)*
- [x] Check every existing whole-project operation in leaf-writer against the exclusion mechanism. **Audit done (2026-07-03).** No single choke point — **three independent enumerators**: (1) `apps/desktop/src/explorerFileOps.ts::listProjectXmlFiles` (Node fs) already skips the `schema/` dir and `isTranslationFile()` — used by metadata apply, the auto-tag crawl, sidebar list; (2) `apps/commons/src/desktop/xpath/collectXmlFiles.ts` (renderer, via `readDirectory`) filters **nothing** at collection, defers scoping downstream — used by project find/replace (`find/searchText.ts`); (3) `explorerFileOps.ts::findXmlFilesByName` (filename search, no exclusion). **Implications for the chosen `/.leaf/` + manifest-role mechanism:** `listProjectXmlFiles` already does a directory skip, so adding `/.leaf/` is a one-liner; `collectXmlFiles` skips nothing and must get the exclusion explicitly (it's the find/replace path — the real leak risk); the manifest `role: "infrastructure"` check is the backstop layer across all three. Existing precedent to mirror: `translationFileNaming.ts::isTranslationFile` is already a "special file role by convention" consulted by enumerators. Still to re-check: exports and normal validation runs must consult the same exclusion.
- [ ] Migration story: what happens when a project already has `@key` values from elsewhere? *(Decided 2026-07-04: voluntary switch → import + remap or purge; lost DB → reconstitute stubs or purge.)*

**Deferred (entity database, not v1):** standalone merge of two database files without corpus; SQLite runtime index; multi-machine concurrent edit; migration from `.leaf/` prototype; move-file wizard on central path change; entity database viewer UI.

**Implementation note (2026-07-04):** Phase 3 code still uses project-root `/.leaf/` paths and `#leafwriter-autotag` — rewire to this spec (central folder resolution, `.ljb/`, database id, validation marker) is the next build step.

**Done when:** the resolved entity file (shared or project-local) holds local ids + authority idnos; mentions point to entities with `@key`; find/replace and other corpus-wide operations provably skip project infrastructure files; the sibling JSONL decision log records Phase 1 accept/reject events.

**Status (2026-07-03):** core built.
- **Entity file model** (`autoTagging/entities.ts`): `createEntitiesScaffold()` (TEI standoff with `<listPerson>`/`<listPlace>`/`<listOrg>`/`<listBibl>`), `nextEntityId(doc, kind)` (typed sequential `person-000001`…, scan-highest+1, collision-safe, never name-derived), `addEntity()` (writes name + `<idno>`s + optional `resp` provenance like `#leafwriter-autotag` + optional `<note type="authority-cache">` JSON), `findEntity()`, plus `ENTITY_KINDS`/`TAG_TO_KIND` maps.
- **Decision log** (`autoTagging/decisionLog.ts`): JSONL record model, `recordFromDecision()` mapping a review `DecisionEvent` → log record, append/parse/deriveCounts, and `DecisionLogBuffer` whose `.add()` matches `ReviewController.onDecision` exactly — the dangling Phase 1 hook now has its consumer (wire it in when the disambiguation UI lands).
- **Exclusion mechanism** (reserved-path layer): `isInfrastructurePath()`/`INFRASTRUCTURE_DIR = '.leaf'` added in both `apps/desktop/src` and `apps/commons/src/desktop` (mirroring `translationFileNaming`). Wired into all three enumerators the audit found: `listProjectXmlFiles` and `findXmlFilesByName` (desktop fs) and `collectXmlFiles` (find/replace, the leak risk) now skip `/.leaf/`. fs-backed and mocked tests prove exclusion. Manifest `role: "infrastructure"` backstop still to add when the project manifest is next touched.
- Tests: +15 Core (entities/decisionLog), +23 desktop/commons (exclusion). Pre-existing unrelated failure noted: `apps/commons/.../updateResultsAfterReplace.test.ts` (find/replace offset math, untouched here).
**Phase 3 completed (2026-07-03):** persistence + log wiring done.
- **Persistence** (`autoTagging/entityStore.ts`): `EntityStore` behind a narrow file API (`ensureDirectory`/`pathExists`/`readFile`/`writeFile`); `loadEntities()` creates `/.leaf/entities.xml` from the scaffold on first use, `saveEntities()` writes back, `appendDecisions()` grows the JSONL log. `entityStoreFromDesktop()` builds one from the desktop globals (null in the web app). Platform-separator aware.
- **Decision log wired to the review walk**: `AutoTaggingSession` now holds a `DecisionLogBuffer`; `logDecision(event)` is passed as the ReviewPanel `onDecision` prop, and `flushDecisions()` (called on dialog close) appends to `/.leaf/entity-decisions.jsonl` via the store — no-op-but-clears in the web app. The dangling Phase 1 hook is now connected end to end.
- Tests: 140 Core total (+ entityStore round-trip, session buffer→flush, web-app no-store path). Typecheck clean.
- Deferred to Phase 4 (where identity is actually assigned): entities get *written* to `entities.xml` during 4a/4b resolution, and `resolved`/`auto-resolved` records join the log. Also still open from the audit: the manifest `role: "infrastructure"` backstop, and confirming exports/validation consult the exclusion.
- **End-to-end smoke test** (`autoTagging/smoke.test.ts`, run `npx jest --selectProjects Core smoke`): against real `test_project/sizhu_shang.xml` it crawls (146 names) → tags untagged occurrences (41) → reviews/logs → applies (21) → seeds one entity in `/.leaf/entities.xml` → flushes 41 decisions to `/.leaf/entity-decisions.jsonl`, printing a trace. Exercises anchor/apply/dictionary/crawl/entities/entityStore/decisionLog together.
- **Fixed a pre-existing unrelated failure**: `apps/commons/.../updateResultsAfterReplace.test.ts` called `updateResultsAfterSingleReplace` with the old arg order — the `replacedHit` object landed in the `ignoreCase` slot (added later), so the incremental-offset-shift path was skipped and the test expected 20 but got a re-scan's 14. Production (`useFindReplace.ts`) passes 7 args correctly; the test was stale. Added the missing `ignoreCase` arg. All 394 tests across Core/desktop/commons now pass.

## Phase 4a — Bulk authority seed & auto-resolve (the "bombard")

DPM's primary bootstrap (Norbert phase-one): fire big authority sets (his own DB export, CBDB, DILA, Wikidata name dumps, etc.) at the corpus to populate the entity database before any hand-disambiguation. This is the workhorse when exhaustive lists exist; AI (Phase 5) is the supplement for the long tail when they don't. Comes right after Phase 3 and before the interactive panel, because it makes the panel have little left to do.

**Decide first:**
- [x] Authority pool format: offline dumps (CBDB/DILA/Wikidata/his SQL export) ingested as candidate records with authority id + names + minimal metadata (dates, type). Offline dump is the primary path; live API is Phase 4b's concern. DPM: I have provided CBDB and DILA in databases. I forget how their names work. I believe that CBDB has full names in the person file, then stores names by name codes (thus just surnames, just given names); by contrast, I think that DILA only has full names (= appropriate search strings). I have also provided a dump, up to the Tang, of my database's search strings for people (including ntName), places, and offices. As this is just for testing, feel free to modify column names, etc. I forgot to include other columns used for disambiguation, like dynasty, zi, and description. 
- [x] Match → outcome rules: unique hit → auto-create/link a project entity (`person-000001` + `<idno>`), mark `resp="#leafwriter-autotag"`; multi-hit → suggestion object carrying the candidate set (stays in the pipeline, not the corpus), routed to the 4b panel or written as `cert="unknown"` on deferral; no hit → left untagged/clean. DPM: sounds good.
- [x] Confidence/precision gate: what counts as a "unique confident" hit safe to auto-assign (exact surface + single authority match; disambiguating metadata agreement?), and the bulk auto-accept threshold. DPM: in Norbert, I output ALL MATCHES, and I divide the results into unique hits, one-to-many, and no hits. There are problems in unique hits, like someone from the Song dynasty appearing in the Han (that signals I need to add someone by the same name). In both cases (one-to-one, one-to-many), we need the option 'none of the above, make a new person.' 
- [x] Reuse, and what "auto-resolve" really means (reconciled with the confidence-gate answer above). **Pipeline reuse:** the seed pass is a *producer* like the dictionary tagger — every corpus match becomes a `Suggestion`, now carrying its authority candidate(s) (unique-hit = one candidate; multi-hit = several). The review pipeline + `applySuggestions` + snapshot/undo are reused unchanged; 4a only *extends* the payload (a suggestion can carry a resolved entity) and the apply step (write `@key` + mint the entity in `entities.xml`). **But "auto-resolve" is NOT blind bulk-apply of unique hits** — per DPM, output ALL matches bucketed (unique / one-to-many / none). Unique hits are the *fast bulk-confirm* bucket: auto-linked with `resp="#leafwriter-autotag"` so they stay filterable and reviewable — the Song-id-in-a-Han-text case is caught by scanning that provenance-marked set, and pre-empted by a metadata precision gate (dynasty/dates) when the pool carries it. Both buckets need **"none of the above → make a new person."** So: reuse the machinery, keep the human judgement, just faster. (This supersedes the earlier shorthand "auto-resolve = accept all unique-hit suggestions".)

**Prepare:**
- [ ] Authority dumps for DPM's corpus (his SQL export first; then CBDB/DILA samples) with a normalizer into the candidate-record shape. Note the name conventions DPM flagged: CBDB stores full names in the person file but also name *codes* (bare surnames / given names) — use the full-name search strings, not the codes; DILA has full names only (already good search strings). **Metadata gap:** the precision gate needs dynasty/dates (and zi/description help review); DPM's current test dump omits them, so either extend the dump or have the gate degrade gracefully (no metadata → treat every hit as needs-review, no metadata-based auto-link).

  **Studied the dumps in `/databases/` (2026-07-04).** Findings that pin down the design:
  - **Unified candidate-record shape** (normalizer target, all sources flatten to it): `{ source, authorityId, kind, searchStrings[], metadata { dynasty, yearRange, placeSubtype, description }, matchRules { followsPlace, followsOffice, followsPerson, isQualifier } }`.
  - **DPM's `all_together.csv`** (74k rows; start here — small, his, encodes his matching logic): cols `person_id,string,abr,tag,office_id,cat,follows_place,follows_office,follows_person,is_qualifier,start_year,end_year`. Tags persName/placeName/officeName/ntName/title; `cat` = place subtype (縣/山/郡…); **`follows_*`/`is_qualifier` are context gates** (e.g. office 丞 only tags after a place/office). Gotchas: booleans serialized as `b'\x01'`, ids as floats (`3854.0`).
  - **CBDB sqlite** (`BIOG_MAIN.c_name_chn` full names + `ALTNAME_DATA` variants; 660k persons, 550 MB): dynasty is a code `c_dy` needing a `DYNASTIES` join (15/18/19/20→宋/元/明/清), plus `c_birthyear`/`c_deathyear`/`c_index_year` for the gate. `張衡` → 5+ persons across dynasties (the multi-hit case).
  - **DILA `Buddhist_Studies_Person_Authority.xml`** (49k persons; +117k places, +districts): **already TEI personography** — `<person xml:id>` + primary/alternative `<persName>` + `<note type="dynasty">` (human-readable) + description; maps ~1:1 onto `/.leaf/entities.xml` (independent validation of our format), so it's the lowest-effort authority to ingest.
  - **Two model implications**: (a) **"office" is a new entity kind** (officeName) — the first "project-defined list" beyond person/place/org/work; `ntName` folds into its person's search strings, not a separate entity. (b) **Context-gating (`follows_*`) is a required matcher feature** — bare 丞/令 over-match without it; the seed matcher needs "match X only when preceded by a place/office/person mention."
  - **Scale forces an index**: 660k CBDB persons can't live in browser memory — build an offline `surface → candidates` index (or query the sqlite in the desktop main process). The 74k CSV loads directly; use it to build and test the whole 4a path first, then DILA, then indexed CBDB.
- [ ] Bulk-apply performance: the bombard may auto-link thousands of mentions in one pass — one snapshot, one undo.

**Done when:** ingest an authority dump → seed pass over the corpus, emitting all matches bucketed (unique / one-to-many / none) → unique hits auto-linked with `resp="#leafwriter-autotag"` (entities minted in `entities.xml`, mentions keyed, one undo) yet still listed for a fast confirm pass; one-to-many queued for 4b; every bucket offers "make a new person"; all decisions logged.

**Status (2026-07-04): core built (context-gating dropped — LJB is general, not Chinese-only).**
- **Candidate model + normalizer** (`autoTagging/authority.ts`): `AuthorityCandidate { source, authorityId, kind, primaryName, searchStrings[], metadata }`; `candidatesFromRows`/`authorityRowsFromCsv`/`candidatesFromCsv` — generic string/tag/id table → grouped candidates. Handles float ids (`3854.0`→`3854`), configurable column map, `cat`→subtype; `ntName` folds into its person; `officeName` deferred (TEI entity home undecided). Language-agnostic.
- **Seed matcher** (`autoTagging/seed.ts`): `seedSuggestions` reuses the tested `dictionaryTag` engine and attaches candidates to each hit; `bucketSeeds` → `{ unique, ambiguous }`; `autoLinkUnique` mints/finds entities (dedupe by `source`+`authorityId`, reused across repeated occurrences), applies tags via the existing engine (one snapshot/undo), then stamps `key` + `resp="#leafwriter-autotag"` on the created elements. Base apply stays tag-only; identity is layered on top.
- **Verified on real data**: `all_together.csv` (16,295 person+place candidates) fired at `sizhu_shang.xml` → 233 matches → **107 auto-linked (unique) + 126 ambiguous (→ 4b)**, 38 entities minted. 155 Core tests pass; typecheck clean.
- **Persisted + wired into the app (2026-07-04):** `AutoTaggingSession.runAuthoritySeed(candidates)` runs the full bombard over the current document — seed → bucket → `autoLinkUnique` → save `entities.xml` via `EntityStore`, reload the keyed corpus, and log one `auto-resolved` record per link (flushed to `/.leaf/entity-decisions.jsonl`); ambiguous count reported. `autoLinkUnique` now returns per-link details for logging. Dialog has a **"Seed from authority (import CSV with ids)"** method that parses the CSV, fires the run, and shows a success summary ("N matches: X auto-linked, Y ambiguous"). Runs as one snapshot (revertable); web app (no store) still tags/keys in-memory but doesn't persist. 156 Core tests pass; typecheck clean.
- **Matching efficiency (2026-07-04):** replaced the naive O(patterns × text) per-string scan with a single-pass `MultiStringMatcher` (`autoTagging/matcher.ts`) — length-bucketed hashing, scan cost O(text × distinctLengths), **independent of dictionary size**. Benchmarked flat scan (~120–160 ms on a 200k-char text) across 10k / 100k / 600k patterns; build is linear and one-time. No regex (exact substrings). `dictionaryTag` and the seed pass both use it. Full write-up in [Auto-tagging.md](Auto-tagging.md) → "Matching performance". This is what makes bombarding with CBDB-scale sets feasible.
- **Still to do for 4a**: metadata precision gate (dynasty/dates — degrades to needs-review when absent); a "make a new person" path; a fast-confirm review of the auto-linked set (currently applied straight, though provenance-marked so filterable); `officeName` entity kind; scale path for CBDB (offline `surface→candidates` index, using the matcher). Note: revert restores the corpus snapshot but leaves minted entities in `entities.xml` (unreferenced, harmless) — entity-file revert is a later refinement.

### ⚠️ Open problems — from DPM live testing (raised 2026-07-04 eve)

Four items. **(1) and (2) done 2026-07-05; (3) done; (4) is future.**

**Resolved 2026-07-05:**
- **(1) single-char matching** — fixed centrally: `dictionaryTag` takes `minLength` (default `DEFAULT_MIN_MATCH_LENGTH = 2`) and drops shorter strings before matching; the seed/crawl paths inherit it (they route through `dictionaryTag`). Per-dialog filters removed.
- **(2) no ids at tag stage** — enforced structurally. `DictionaryEntry` is now `{string, tag}` only; `entriesFromRows`/`parseDictionaryTable` ignore all extra columns (an authority CSV with `person_id` etc. tags as a plain string/tag list); `dictionaryTag` and `crawlEntities` never write `attributes`/`@key`/`@ref`. Removed the tag-time minting: `AutoTaggingSession.runAuthoritySeed` and the dialog's "Seed from authority" button are gone. Dictionary and authority are now the same "Tag from a list" method at the tag stage. The 4b primitives (`MultiStringMatcher`, `authority.ts` normalizer, `seed.ts` `autoLinkUnique`/`bucketSeeds`) remain for disambiguation to assemble; they are just no longer wired to the tag UI.
- **(3) compact UI** — the dialog is rewritten minimal/left-aligned/small: fixed 340px width (not `fullWidth maxWidth=md`), left-aligned small text-buttons, tight padding, plain text links for actions. One "Tag from a list (CSV, TSV, xlsx, ODS)" method + crawl; dates/AI/NER shown small and disabled.
- 163 Core tests pass; typecheck clean.

**Still open:**
1. **One-character strings are still being matched — "not viable."** *(DONE — see above.)* Leak located: the dictionary/crawl path filters single-char strings in the dialog (`produceFromEntries`: `[...entry.string].length > 1`), but the **authority seed path filters only `primaryName`** (`seedFromAuthority`), so a candidate with a multi-char primary name can still contribute single-char *searchStrings* (variants, `ntName`) as patterns. Fix properly: enforce a **minimum surface length centrally** in the producer/matcher (skip patterns with ≤ 1 code point), not per-dialog-method — make it a `minMatchLength` option (default 2) so it stays general (LJB is not Chinese-only; a project could lower it). Will require updating the crawl test that uses single-char `甲/乙/丙` fixtures to multi-char.

2. **No id insertion at the tagging stage — collapse "dictionary" vs "authority".** DPM restates a firm principle: **tagging only wraps text in tags; ALL identity/`@key`/entity work happens at the disambiguation stage.** Rationale: clean separation, and he hand-edits XML between phases where stray attributes make that "a different game." Consequence: **today's `runAuthoritySeed`/`autoLinkUnique` (which mint entities + write `@key`+`resp` at tag time) overstep and must be pulled back** — at the tag stage, authority seeding should behave exactly like dictionary tagging: produce plain tag suggestions through the review walk, no ids, no `entities.xml` writes. This also answers his "what's the difference between dictionary and authority?" — **at the tag stage there is none**; both are just string→tag lists. The authority's ids/metadata are *set aside* for the disambiguation phase (4b), which resolves already-tagged mentions against the authority pool (unique auto-resolve, multi-hit panel — all the linking logic moves here). Keep the useful parts built today (the `MultiStringMatcher`, the candidate normalizer `authority.ts`, the seed matcher's *tagging*); relocate the minting/`@key` logic (`autoLinkUnique`, `resolveEntity`, the seed part of `runAuthoritySeed`) to Phase 4b. Likely UI outcome: one "tag from a list" method that accepts CSV/xlsx/authority dumps and simply ignores id columns at tag time.

3. **UI is far too big/bulky — "Japanese apartment".** Design directive for the whole auto-tagging UI (and a model for LJB generally): **minimal, unobtrusive, left-aligned, small.** Not full-screen. The current dialog is `fullWidth maxWidth="md"` with large centered full-width stacked buttons and heavy padding — the opposite of what's wanted. Redo compact: left-aligned, small type, tight spacing, modest width, dense method list. (A previous compact pass was reverted; reinstate deliberately.)

4. **Later: adopt the MARKUS paradigm for dictionary/list tagging.** Not now, but the eventual paradigm for list-based tagging should mirror MARKUS: **checkboxes to select which authorities to use, a date slider/filter, and a combined pass that tags from the chosen set together** — rather than importing one list at a time. This is the natural home for multi-authority + date-scoped tagging once 4a/4b settle.

## Phase 4b — Interactive disambiguation panel

The panel for the leftovers 4a couldn't auto-resolve, plus live authority lookups.

**Decide first:**
- [x] **Live lookup v1 (2026-07-04):** see table below. **Pragmatic v1:** reuse the existing **LINCS reconcile API** (`lincs-api.lincsproject.ca/api/link/reconcile`) for VIAF, Wikidata, DBpedia, GeoNames, Getty, GND — already wired in LEAF-Writer's entity lookup. **Offline dumps only** for CBDB, DILA, CHGIS, and the user's own SQL/CSV exports (no public live APIs suitable for v1). Politeness: project cache in `.ljb/authority-cache/`; query on demand when a string is opened (not per keystroke); debounce; ~1 req/s max through LINCS; identify User-Agent as Le Jean-Baptiste; long TTL cache (30 days default) + manual refresh; batch only within a single reconcile call (already multi-authority). Direct-to-source APIs deferred unless LINCS is unavailable.
- [x] **Cache policy (2026-07-04):** `.ljb/authority-cache/` per project; **30-day TTL**; manual refresh button per string or global.
- [x] **Re-running disambiguation (2026-07-04):** each launch is **incremental**, never destructive. Mentions with `@key` pass through as **already disambiguated** (shown in UI, skipped by default filter). Mentions with `cert="unknown"` and no `@key` remain **eligible** for another pass. **Never** auto-purge `@key` on re-run — purge is manual only (Project settings / explicit recovery action). Tagged-but-unkeyed mentions are fair game every time.
- [x] **Buttons (2026-07-04):** accept this occurrence; accept all identical strings **in this document** (default bulk scope — never corpus-wide); create new entity; mark unresolved; ignore (X, moves to bottom); split group. **Accept across open tabs:** deferred.
- [x] **Add-description popup (2026-07-04):** all fields optional. Pre-fill from authority scrape where available (dates, one-sentence description). Free-text user note always allowed ("the cheese guy"). Purpose: disambiguation aid only, not publication metadata.
- [x] **Mark unresolved (2026-07-04):** writes `cert="unknown"`, no `@key`, red irritant styling. **Do not drop** candidate suggestions — persist in `.ljb/` (pending/disambiguation cache). Corpus mentions stay tagged.
- [x] **Grouping/collapse (2026-07-04):** (1) **Entity file is authoritative** — if local entity already has `<idno>` links, auto-merge authority hits that match those ids into one candidate row. (2) **Cross-authority indexes** — when an authority exposes equivalences (e.g. Wikidata → VIAF via P214), use them to collapse proposals. (3) **Manual link** — user can select two proposals (e.g. separate Wikidata + VIAF hits) and attach both to one local entity, indexing them together in `entities.xml`. (4) **Multiples allowed** — same authority type can appear more than once on one entity (e.g. two VIAF records for the same person). (5) **UI:** source icon per proposal; stacked icons when proposals are linked/merged.

| Authority | v1 mode | Query shape | Notes |
|-----------|---------|-------------|-------|
| VIAF | Live via LINCS reconcile | name string → URI + label + description | OCLC direct API exists but LINCS proxy is simpler; cache aggressively |
| Wikidata | Live via LINCS reconcile | name string → URI + label + description | Direct: `wbsearchentities`, User-Agent required, no heavy scraping |
| DBpedia | Live via LINCS reconcile | name string | Same |
| GeoNames | Live via LINCS reconcile | place name | Direct API needs free registration (30k credits/day); dump also available |
| Getty (ULAN/TGN) | Live via LINCS reconcile | name string | SPARQL endpoint exists; LINCS preferred for v1 |
| GND | Live via LINCS reconcile | name string | Deutsche Nationalbibliothek |
| CBDB | **Offline dump only** | local sqlite / indexed surface→candidates | No public lookup API; 660k rows — desktop index |
| DILA | **Offline dump only** | ingested TEI/XML | Buddhist Studies Authority — file download |
| CHGIS | **Offline dump only** | ingested dump | Historical GIS — no live API in v1 |
| User SQL/CSV | **Offline dump only** | import + index | Norbert-style personal database |

**Politeness defaults (v1):** cache-first; one reconcile request per unique string per session unless cache miss or manual refresh; 1 req/s throttle; offline authorities never hit the network; document LINCS/Wikidata terms in About/legal if needed.

**Prepare:**
- [x] **API keys (2026-07-04):** **none required for Phase 4b v1.** LINCS reconcile is open POST (no key). Optional LINCS *account login* on the web app yields `moreResults` — not applicable to desktop v1 unless we add LINCS sign-in later. GeoNames direct API needs a free *username* only if bypassing LINCS (deferred). **AI API keys** (App Settings) are Phase 5 only. Custom user-configured authority endpoints may carry keys later — out of 4b scope.
- [ ] UI mock: tag selector → unique-string tree → instances → candidate list.
- [ ] Recorded/mock authority responses for offline development and tests.

**Done when:** select `<persName>` → tree of unique strings → candidates from entity file + seeded pool + live authorities → accept assigns local entity `@key`, creating the entity if new; filter hides fully-resolved strings; all decisions land in the decision log.

## Phase 5 — AI suggest & AI audit

**Decide first:**
- [x] **Provider/model strategy (2026-07-04):** Mistral family only for v1 — a local Ministral model (served via an Ollama-compatible endpoint) for development/no-cost use, with the hosted Mistral API as the BYO-key fallback for users without local hardware. Frontier-model spend (Anthropic et al.) deferred until it's needed. Key stored via the OS keychain on desktop, never in project JSON (projects get shared); the AI method stays greyed out in the dialog until a key/local endpoint is configured. One `LlmClient` interface behind both — response-contract validation is the real portability layer, so a future provider is one more class, not a redesign.
- [x] **NER dropped from v1 scope (2026-07-04).** Deferred/future per the existing "Deferred / future" section — Phase 5 is suggest + audit only.
- [x] **Response contract (2026-07-04):** structured outputs (`response_format`/`format` JSON schema on both the Ollama and Mistral paths) constrain the shape; every item still goes through two-layer validation before it can become a suggestion — (1) schema/field validation (tag ∈ requested set, action ∈ allowed set for the task, confidence ∈ [0,1]) and (2) anchor verification against the live document (surface + occurrence, resolved through the existing anchor machinery — no offsets, no regexes). Anything failing either layer is dropped and counted, never applied.
- [x] **Chunking (2026-07-04):** structural, not fixed-size — cut only at block-element boundaries (`p`/`div`/`l`/`lg`/`head`/`ab`/`item` by default) so chunks never split mid-sentence. Chunks are **non-overlapping owners** of the document's search-text offsets (this is what keeps occurrence counting unambiguous — no overlap-region dedup needed); a read-only context margin (default 200 chars) is included before/after each chunk but is explicitly marked in the prompt as not-taggable. Falls back to one whole-document chunk when no recognized block elements exist.
- [x] **Cache key (2026-07-04):** `(chunk hash, tag set, model id, prompt version)`, exactly as scoped. Lives in `.ljb/ai-cache/` per project (same convention as the Phase 4b authority cache: 30-day TTL, JSON files, in-memory + on-disk tiers). Stores the validated, chunk-relative parsed items — not final anchored suggestions, since anchoring must always run fresh against the live (possibly-edited) document.
- [ ] Auto-accept rules format (per-tag confidence thresholds) and where they're stored — not yet built; see Claude's suggestion in the AI-integration discussion (project settings, reusing `acceptAllAbove(confidence)` from Phase 1 as pre-accepted-but-still-reviewable rows).
- [x] **Prompt versioning (2026-07-04):** prompts are source-level string constants per task (`suggest.v1`, `audit.v1`), assembled from a shared preamble module (locator rules, JSON discipline) plus a per-task block (tag definitions for suggest, error taxonomy for audit). Bump the version constant on any semantic change — that's what the cache key hashes, so a bump correctly invalidates only that task's cache.
- [x] **Separate prompts per task, not stacked (2026-07-04):** suggest, audit (and future translation) are separate requests with separate output schemas, sharing only the preamble text. Decided against stacking because: a small local model (Ministral-class) degrades on multi-objective instructions where a frontier model wouldn't; the output shapes genuinely differ (`add`-only vs `keep/add/remove/retag/redraw-boundary`, plain-text input vs already-tagged input); and stacking would invalidate the whole cache whenever any one task's instructions change, whereas separate prompts cache independently. The one sanctioned "stacking" is multiple tag types in one suggest pass (already decided in Auto-tagging.md) — that's one task with one output shape, not several tasks.

**Prepare:**
- [x] Prompt drafts for suggest and audit — `autoTagging/prompts.ts` (`buildSuggestPrompt`, `buildAuditPrompt`), tested via the fake-client suites; hand-testing against real documents with the local Ministral model is the next step before wiring the UI.
- [ ] Cost estimate on a realistic document to size chunking and batching — deferred; more relevant once a hosted-API path is actually exercised (local model is free).
- [ ] A validation harness: run suggest on a manually-tagged document (e.g. `sizhu_shang.xml`, already densely tagged) and measure precision/recall before wiring the UI. Not yet built — natural next step once a local model is available to test against.

**Status (2026-07-04): core built.**
- **Chunking** (`autoTagging/chunk.ts`): `chunkDocument(doc, options)` — structural, block-boundary chunking (never cuts inside a `p`/`div`/`l`/`lg`/`head`/`ab`/`item`), non-overlapping ownership of document search-text offsets, configurable context margin, whole-document fallback when no block elements are recognized.
- **LLM client** (`autoTagging/llmClient.ts`): `LlmClient` interface (`modelId`, `complete(request) → {json, usage}`); `OllamaLlmClient` (local Ministral or anything else Ollama serves, `/api/chat` with a JSON-schema `format`) and `MistralLlmClient` (hosted API, BYO key, `response_format: json_schema`). Both take an injectable `fetch` for testing.
- **Prompts** (`autoTagging/prompts.ts`): shared preamble (locator rules: verbatim surface, occurrence-within-chunk, no offsets, no markdown fences) + `buildSuggestPrompt`/`buildAuditPrompt` + `suggestionResponseSchema(actions)` for the structured-output schema. Versioned via `SUGGEST_PROMPT_VERSION`/`AUDIT_PROMPT_VERSION`.
- **Cache** (`autoTagging/llmCache.ts`): `LlmCache` — same file-API/in-memory-tier shape as the Phase 4b `AuthorityCache`, keyed on `(chunk hash, sorted tag set, model, prompt version)`, 30-day TTL, corrupt-entry-safe.
- **Validation** (`autoTagging/llmParse.ts`): `parseValidItems` (schema/field layer — bad JSON, wrong shape, unrequested tag/action, out-of-range confidence all drop silently); `findOccurrenceOffset` + `locateInDoc` (anchor-verification layer — resolves a chunk-relative surface/occurrence claim back to a real text-node span via the existing `DocIndex`, returning `null` on any hallucinated or boundary-crossing claim).
- **Producers**: `autoTagging/llmSuggest.ts` (`llmSuggest(doc, options) → {suggestions, unverifiableCount}`, emits plain `'ai'`-source `add` suggestions, no ids, through the same `Suggestion` shape every other producer uses) and `autoTagging/llmAudit.ts` (`llmAudit(doc, options) → {suggestions, unverifiableCount}`, renders each chunk with its existing tags shown inline as `<TAG>surface</TAG>` markers so the model can see current boundaries, then verifies and emits `add`/`remove`/`retag`/`redraw-boundary` findings against the live document).
- Both producers take an optional `LlmCache`; a same-document re-run with an identical chunk/tag-set/model/prompt-version hits cache and makes zero model calls (tested).
- 32 new tests across `chunk`, `llmCache`, `llmParse`, `llmSuggest`, `llmAudit` (fake in-memory `LlmClient` implementations — no network in tests); all pass, typecheck clean (pre-existing unrelated `integration.ts` TS2774 and pre-existing React-act failures in `mentions`/`reviewController`/`ReviewPanel` untouched).
- **Still open:** auto-accept rules storage/UI; apply-side handling for `remove`/`retag`/`redraw-boundary` actions in `apply.ts` (today only `add` is applied — audit's other actions reach the review walk correctly shaped but still need an apply-engine branch); hand-testing audit prompts against a running local Ministral model.
- **UI wired (2026-07-04):** Auto-tagging dialog → **AI suggest** (desktop only) reads Application Settings → AI API, runs `llmSuggest` with `suggest.v3`, persists chunk cache under `.ljb/ai-cache/`, hands off to the docked review panel. Tag picker: `persName` / `placeName` (bootstrap only — see **Immediate future** below).
- **Validation harness (2026-07-04): built and run live.** `validationHarness.ts` + opt-in `validationHarness.live.test.ts`. **Gold-standard (`gold_test.xml`, 65 mentions):** Groq Qwen3.6-27B + `suggest.v3` **F1=.74 R=.68** (~5 s) — best run; prompt v1→v3 nearly doubled recall. Earlier: local Ministral F1=.37; hosted Mistral F1=.35. Full numbers in [phase5-validation-results.md](phase5-validation-results.md).
- **Provider/free-tier options (2026-07-04):** surveyed beyond the local Ministral instance — Groq's free tier hosts a genuine Qwen3-32B at 60 RPM/500K TPD (official docs), enough for ~8 full-document runs/day at zero cost, and speaks the same OpenAI-compatible shape `MistralLlmClient` already handles (model/baseUrl swap only). Mistral's own hosted free tier no longer publishes exact numbers; third-party estimates (~2 RPM) would make it no faster than local for full-document runs. GuwenBERT and similar encoder-only classical-Chinese models don't fit this architecture at all — they'd need a token-classification head, i.e. the deferred NER path, not another `LlmClient`. Full write-up and the recommended next comparison (Groq Qwen3-32B once a properly complete gold document exists) in [phase5-ai-integration-log.md](phase5-ai-integration-log.md).

### Immediate future (2026-07) — build next

Full spec in [Auto-tagging.md](Auto-tagging.md) → AI mode → **Immediate future**. Summary:

**A. Prompt profiles (model- and corpus-specific)**

- [ ] **Storage:** `.ljb/ai-prompt-profiles.json` (project) and/or app-level profiles beside AI API settings. Fields: `id`, `label`, optional `modelPattern`, editable suggest suffix, per-tag guide overrides, `version`.
- [ ] **UI:** AI suggest step shows active profile; “Edit prompt…” without editing repo files. Auto-match profile to configured model (e.g. Qwen3.6 vs Ministral).
- [ ] **Assembly:** keep locator/JSON rules locked (`preamble.txt`); user edits task bias and tag definitions only. Wire optional reuse of App Settings `customInstructions` for suggest (today translation-only).
- [ ] **Cache:** profile `version` (or profile id) participates in LLM cache key alongside `SUGGEST_PROMPT_VERSION`.
- [ ] **Validation loop:** harness run per profile/model; record in `phase5-validation-results.md`. Known need: shorter/alternate profile for local Ministral (v3 regressed vs v1).

**B. Expandable tag types (schema- and project-driven)**

- [ ] **UI:** replace hardcoded `persName`/`placeName` checkboxes with schema-driven or project-allowlist tag picker (same list shape `llmSuggest` already accepts).
- [ ] **Definitions:** extend `prompt-templates/tag-definitions.json` — priority `roleName`, `orgName`, then `title`/`date` as schema allows.
- [ ] **Gold:** extend `gold_test.xml` or add passage with hand-tagged offices/institutions; per-tag P/R in harness before enabling defaults.
- [ ] **Modeling note:** `roleName` vs `persName` boundary is the main tuning risk on 後漢書-style text; `roleName` may not map to standoff entities (Phase 4a).

**Done when (Phase 5 “prompt + tags” slice):** items A and B above ship; harness documents at least one non–persName/placeName tag family on gold; user never needs to edit `prompt-templates/` in the repo for day-to-day tuning.

**Done when (Phase 5 overall):** AI suggest and audit both emit verified suggestion objects through the same review walk; re-running on an unchanged document hits cache and costs nothing; unverifiable model output is dropped, never applied.

## Phase 6 — AI-assisted disambiguation ranking

**Decide first:**
- [ ] Context recipe: which signals (date range, nearby names, resolved entities, decision log…) go into the prompt, and their size budget.
- [ ] Ranking output contract (ordered candidates + one-line reasons) and how it merges into the Phase 4 candidate list.
- [ ] When ranking fires: automatically per string, on demand per string, or batched for the whole panel launch (cost).

**Prepare:**
- [ ] Prompt drafts tested against known-hard cases (the 張衡 problem).
- [ ] Reuse Phase 5's caching/batching layer — confirm its key shape covers this use.

**Done when:** candidate lists arrive pre-ranked with rationales; accepting works exactly as in Phase 4.

## Deferred / future (revisit, no work now)

- NER via user-supplied language models (emits suggestion objects when it comes).
- Cross-session re-anchoring of suggestions (surface + context + hash fields are already in the schema).
- Cross-method priority policy (working assumption: sequential passes; revisit when two methods actually collide in practice).
- Direct SQL sources for dictionaries and power-user external databases (Norbert-style).
- Entity-file viewer/editing tools beyond the add-description popup.
- Corpus-wide propagation of disambiguation with AI outlier flagging.
