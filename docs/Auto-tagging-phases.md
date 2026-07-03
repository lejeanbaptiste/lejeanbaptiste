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
- **Internal crawl** (`autoTagging/crawl.ts`): `crawlEntities(doc, policy, tags?)` compiles a dictionary from entities already tagged in the current document (default TEI entity tag set), normalizing surfaces with the whitespace policy and propagating an entity id (`@key`/`@ref`) only when every tagged instance of a surface agrees (conflicting or partial → no id; that surface belongs to the disambiguation pass). New dialog method "From existing tags in this document". Scope is the current document; "open documents" (cross-tab) deferred.
- **Producer dedup moved earlier**: `dictionaryTag` now skips matches already inside the target tag (ancestor check), so the review list no longer shows no-op items; apply-time dedup remains as a safety net. 119 tests pass.
- There should be NO disambiguation or id-ing at this stage.

## Phase 3 — Project entity file & decision log

The disambiguation substrate. No UI beyond what's needed to create the file.

**Decide first:**
- [x] Exact TEI shape: one project-level TEI standoff file at `/.leaf/entities.xml`. V1 includes `<listPerson>`, `<listPlace>`, `<listOrg>`, and `<listBibl>`, and must allow additional project-defined lists for tags the user adds and wants to disambiguate.
- [x] Local id scheme: typed sequential `xml:id`s (`person-000001`, `place-000001`, `org-000001`, `work-000001`, etc.). Generation scans existing ids for the type, takes the next suffix, and increments on collision. Do not derive ids from names.
- [x] Mentions use `@key`, not `@ref`, with a bare local id: `<persName key="person-000001">張衡</persName>`. The project entity file location is resolved by project metadata/default convention, not encoded into each mention.
- [x] Recognized `<idno>` types: canonical `CBDB`, `Wikidata`, `VIAF`, `DILA`, `CHGIS`, and `GeoNames` (places). Cached authority display data is optional compact JSON in `<note type="authority-cache" source="..." resp="leaf-writer" when="...">`; `<idno>` values remain the source of truth.
- [x] Decision log: sibling append-only JSONL file at `/.leaf/entity-decisions.jsonl`, not inside `entities.xml`. Each event records timestamp, document path/id, surface, tag, action, source method, optional entity id or rejected candidate, scope (`occurrence`, `document-surface`, later maybe `selection`), and optional anchor/context hash. Counts are derived from the log.
- [x] **The exclusion mechanism**: reserve `/.leaf/` for infrastructure by default and mark infrastructure files explicitly in the project manifest, e.g. `role: "infrastructure"` with `kind: "entity-authority"` or `kind: "decision-log"`. The manifest role is authoritative; whole-project find/replace, auto-tagging crawls, exports, and normal corpus validation skip these files unless a command explicitly targets project infrastructure.
- [x] **Candidate / unresolved representation** (decided in place of Norbert's in-document `|` lists): the corpus XML holds only *terminal* states — (1) resolved: `key="person-000001"` (single local id); (2) deferred/ambiguous: TEI-native `cert="unknown"` marker with no key, styled red in the editor as a deliberate irritant (the equivalent of Norbert's red 'ambiguous' tag); (3) not-an-entity: tag removed. **Candidate sets are pipeline artifacts, not document state** — a multi-hit is a suggestion object carrying N candidate entities, held in the review pipeline + pending cache and regenerable by re-running the seed/bombard (matches the Norbert habit of discarding the `|` list on deferral). Provenance: machine-auto-resolved mentions carry `resp="#leafwriter-autotag"` (or `cert="high"`) to distinguish confident auto-links from human-confirmed ones, so auto-links can be bulk-trusted yet still filtered for spot-checking. Entities are written to `entities.xml` only when resolved or auto-resolved (unique hit) — never speculative candidates, so every entity in the file is real and referenced.

**Prepare:**
- [ ] Survey existing TEI personography conventions/tools for interop before inventing anything. *(Not done as a formal tool survey. Shape is standard: `<standOff>`/`<listPerson>`+`<listPlace>`+`<listOrg>` with `<person xml:id>`, names in `<persName>`, authority links as `<idno type="VIAF|Wikidata|CBDB">`; interop tools (CETEIcean, TEI Publisher) expect this. Chosen model uses `@key` with bare local id — confirm target tools accept `@key` vs `@ref` before locking.)*
- [x] Check every existing whole-project operation in leaf-writer against the exclusion mechanism. **Audit done (2026-07-03).** No single choke point — **three independent enumerators**: (1) `apps/desktop/src/explorerFileOps.ts::listProjectXmlFiles` (Node fs) already skips the `schema/` dir and `isTranslationFile()` — used by metadata apply, the auto-tag crawl, sidebar list; (2) `apps/commons/src/desktop/xpath/collectXmlFiles.ts` (renderer, via `readDirectory`) filters **nothing** at collection, defers scoping downstream — used by project find/replace (`find/searchText.ts`); (3) `explorerFileOps.ts::findXmlFilesByName` (filename search, no exclusion). **Implications for the chosen `/.leaf/` + manifest-role mechanism:** `listProjectXmlFiles` already does a directory skip, so adding `/.leaf/` is a one-liner; `collectXmlFiles` skips nothing and must get the exclusion explicitly (it's the find/replace path — the real leak risk); the manifest `role: "infrastructure"` check is the backstop layer across all three. Existing precedent to mirror: `translationFileNaming.ts::isTranslationFile` is already a "special file role by convention" consulted by enumerators. Still to re-check: exports and normal validation runs must consult the same exclusion.
- [ ] Migration story: what happens when a project already has `@key` values from elsewhere? *(Not started — depends on the local-id scheme already decided (`person-000001` etc.). Likely shape: an import pass that mints local entities and ingests any pre-existing `@key`/`@ref` values as authority `<idno>`s, rewriting mentions to the new local `@key`. Defer until Phase 3 build.)*

**Done when:** a project can hold `/.leaf/entities.xml` with local ids + authority idnos; mentions point to entities with `@key`; find/replace and other corpus-wide operations provably skip infrastructure files; the sibling JSONL decision log records Phase 1 accept/reject events.

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
- [ ] Authority pool format: offline dumps (CBDB/DILA/Wikidata/his SQL export) ingested as candidate records with authority id + names + minimal metadata (dates, type). Offline dump is the primary path; live API is Phase 4b's concern.
- [ ] Match → outcome rules: unique hit → auto-create/link a project entity (`person-000001` + `<idno>`), mark `resp="#leafwriter-autotag"`; multi-hit → suggestion object carrying the candidate set (stays in the pipeline, not the corpus), routed to the 4b panel or written as `cert="unknown"` on deferral; no hit → left untagged/clean.
- [ ] Confidence/precision gate: what counts as a "unique confident" hit safe to auto-assign (exact surface + single authority match; disambiguating metadata agreement?), and the bulk auto-accept threshold.
- [ ] Reuse: the seed pass emits the same suggestion objects as the dictionary producer; auto-resolve is "accept all unique-hit suggestions", using the existing apply engine + snapshot/undo.

**Prepare:**
- [ ] Authority dumps for DPM's corpus (his SQL export first; then CBDB/DILA samples) with a normalizer into the candidate-record shape.
- [ ] Bulk-apply performance: the bombard may auto-resolve thousands of mentions in one pass — one snapshot, one undo.

**Done when:** ingest an authority dump → seed pass over the corpus → unique hits auto-linked (entities minted in `entities.xml`, mentions keyed + provenance-marked, one undo) → multi-hits queued for 4b; all decisions logged.

## Phase 4b — Interactive disambiguation panel

The panel for the leftovers 4a couldn't auto-resolve, plus live authority lookups.

**Decide first:**
- [ ] Which authorities support live lookup in v1, per authority: API vs. periodic dump, query shape, and license/politeness constraints (rate limits, batch sizes).
- [ ] Cache policy: where cached responses live, TTL, manual refresh.
- [ ] Grouping/collapse rules: when two authority hits merge into one candidate (already linked in entity file vs. heuristic match).
- [ ] Button set final list and semantics — especially "accept for all identical strings *in this document*" (document-scoped, never corpus-wide) and "split group".
- [ ] The add-description popup: which fields, required vs. optional.
- [ ] "Mark unresolved" writes `cert="unknown"` (no key), the visible red irritant; candidates are dropped from the corpus (regenerable by re-seeding).

**Prepare:**
- [ ] API keys / endpoint access for chosen authorities; record them in project config design (per-user, not per-project, presumably).
- [ ] UI mock: tag selector → unique-string tree → instances → candidate list.
- [ ] Recorded/mock authority responses for offline development and tests.

**Done when:** select `<persName>` → tree of unique strings → candidates from entity file + seeded pool + live authorities → accept assigns local entity `@key`, creating the entity if new; filter hides fully-resolved strings; all decisions land in the decision log.

## Phase 5 — AI suggest & AI audit

**Decide first:**
- [ ] Provider/model strategy: which API, whether the user brings his own key, cost display to the user.
- [ ] Response contract: the exact JSON the model must return (verbatim string + occurrence + context — no offsets, no regexes) and the validation applied to it.
- [ ] Chunking parameters: chunk size, overlap, how chunk boundaries interact with occurrence counting.
- [ ] Cache key definition: (chunk hash, tag set, model, prompt version) — and where the cache lives.
- [ ] Auto-accept rules format (per-tag confidence thresholds) and where they're stored.
- [ ] Prompt versioning: how prompts are stored/updated so the cache key is honest.

**Prepare:**
- [ ] Prompt drafts for suggest (multi-tag single pass) and audit (keep/add/remove/retag/redraw), tested by hand against real documents.
- [ ] Cost estimate on a realistic document to size chunking and batching.
- [ ] A validation harness: run suggest on a manually-tagged document and measure precision/recall before wiring the UI.

**Done when:** AI suggest and audit both emit verified suggestion objects through the same review walk; re-running on an unchanged document hits cache and costs nothing; unverifiable model output is dropped, never applied.

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
