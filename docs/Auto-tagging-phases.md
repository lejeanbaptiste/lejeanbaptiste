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
- [ ] Exact TEI shape: `<standOff>` in one file per project? File name/location convention? `<listPerson>`/`<listPlace>`/`<listOrg>`/`<listBibl>` — which lists in v1?
- [ ] Local id scheme (format, generation, collision policy).
- [ ] `@key` vs `@ref` on mentions, and the pointer syntax to the entity file.
- [ ] Which `<idno>` types are recognized (CBDB, Wikidata, VIAF, DILA, CHGIS…) and how cached authority data is stored on the entity (custom namespace? `<note type="cached">`?).
- [ ] Decision-log format and location (same file or sibling), and what exactly is recorded (surface → tag counts; surface → entity choices; rejections).
- [ ] **The exclusion mechanism**: how files are marked as infrastructure so find/replace/whole-project operations skip them by role — this likely touches code outside this feature, so decide the mechanism (file role in project manifest? reserved path?) before creating the first entity file.

**Prepare:**
- [ ] Survey existing TEI personography conventions/tools for interop before inventing anything.
- [ ] Check every existing whole-project operation in leaf-writer (find, replace, crawl, export, validation runs) against the exclusion mechanism.
- [ ] Migration story: what happens when a project already has `@key` values from elsewhere?

**Done when:** a project can hold an entity file with local ids + authority idnos; mentions can point to it; find/replace provably never touches it; the decision log records Phase 1 accept/reject events.

## Phase 4 — Disambiguation panel & authority lookups

**Decide first:**
- [ ] Which authorities in v1, and per authority: API vs. periodic dump, query shape, and license/politeness constraints (rate limits, batch sizes).
- [ ] Cache policy: where cached responses live, TTL, manual refresh.
- [ ] Grouping/collapse rules: when two authority hits merge into one candidate (already linked in entity file vs. heuristic match).
- [ ] Button set final list and semantics — especially "accept for all identical strings *in this document*" (document-scoped, never corpus-wide) and "split group".
- [ ] The add-description popup: which fields, required vs. optional.
- [ ] What "mark unresolved" writes into the XML, if anything.

**Prepare:**
- [ ] API keys / endpoint access for chosen authorities; record them in project config design (per-user, not per-project, presumably).
- [ ] UI mock: tag selector → unique-string tree → instances → candidate list.
- [ ] Recorded/mock authority responses for offline development and tests.

**Done when:** select `<persName>` → tree of unique strings → candidates from entity file + authorities → accept assigns local entity id in `@key`/`@ref`, creating the entity if new; filter hides fully-resolved strings; all decisions land in the decision log.

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
