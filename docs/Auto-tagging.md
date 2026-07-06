# Auto-tagging

## Architecture: the suggestion object

Every auto-tagging method — dictionary, dates, AI, NER, and later disambiguation — emits the same intermediate object rather than touching the XML itself. All the shared machinery (review UI, apply, undo, conflict resolution, logging) is built once against this object.

A suggestion looks roughly like:

```json
{
  "id": "sug_0042",
  "source": "dictionary | dates | ai | ner | disambiguation",
  "sourceDetail": "e.g. dictionary table name, model id, ruleset version",
  "action": "add | remove | retag | redraw-boundary | assign-entity",
  "tag": "persName",
  "attributes": { "key": "p0123" },
  "anchor": {
    "documentId": "...",
    "xpath": "/TEI/text/body/div[2]/p[3]/text()[1]",
    "offset": 47,
    "surface": "張衡",
    "occurrence": 2,
    "contextBefore": "太史令",
    "contextAfter": "造候風地動儀",
    "nodeHash": "..."
  },
  "confidence": 0.95,
  "rationale": "Nearby text discusses calendrical instruments.",
  "status": "pending | accepted | rejected | unresolvable"
}
```

Key points:

- **Anchoring** follows the W3C Web Annotation selector model in spirit: verbatim surface string + occurrence/context is the primary locator, XPath + offset is the fast path, and the hash detects staleness. If the string isn't found where claimed, the suggestion is dropped or flagged as unresolvable — never mis-applied. Within a single session we can instead insert temporary ids on affected nodes and flush them when the session ends; the fuzzy re-anchoring machinery is only needed across sessions and is deferred.
- **Apply is one engine.** It performs insert-into-text-node, dedup, and schema-rule checks (checking whether the target context allows the tag *before* insertion, not just repairing after), then validates.
- **One undo step.** Applying a batch of suggestions is a single undoable operation, and nothing is applied until it passes through the review gate.
- **Review is one UI.** The split-screen audit walk (editor on one side, to-do list on the other, keyboard-navigable like find-and-replace, with per-item rationale and ok/reject/correct) is the commit gate for *all* methods, not just AI audit. "Dumb" methods just produce suggestions with `rationale` like "matched dictionary entry X".
- Accepted/rejected decisions are appended to the **decision log** (see Disambiguation), which feeds both future defaults and AI context.

### Phase 0 specifications (decided)

**Normalization is central and happens once.** On document load (before any anchor is created or verified), text nodes are NFC-normalized at a single central point. Producers and the verifier never normalize independently — they assume NFC. This keeps offsets and occurrence counts consistent between the process that created an anchor and the one resolving it.

**Whitespace policy.** Matching operates on a *search text* derived from text nodes, with an offset map back to raw positions so insertion happens at the correct raw offset. Two policies, a project setting defaulted from the document language: `ignore` (whitespace stripped — CJK documents, where in-node whitespace is layout noise and may fall mid-name) and `collapse` (runs collapsed to a single space — whitespace-delimited languages). Occurrence counting ("2nd occurrence of 張衡") is computed on the search text of the whole document, in document order — same policy on both sides.

**Anchor resolution tiers.** (1) Fast path: XPath resolves and the node hash matches → use the stored offset. (2) XPath resolves but hash differs → search within that node for the surface string, disambiguating by context. (3) Whole-document search by surface + occurrence index, context as tiebreaker. (4) Otherwise the suggestion is marked `unresolvable` — never applied approximately. Context windows are taken from the *document-level* search-text stream (crossing text-node boundaries), because a tagged name is often a text node containing nothing but the name itself, leaving no node-local context. A candidate only wins re-anchoring with positive, uniquely-best context agreement — a lone surface match with zero matching context is rejected, since the XPath may have drifted onto the wrong node.

**Temporary ids.** In-session anchoring uses the editor's existing DOM ids (leaf-writer's editing representation already assigns HTML `id`s to tags — see `tagger.ts` — which never serialize to XML), so no schema-compatibility issue arises and nothing needs flushing from the XML itself.

**Pending-batch persistence.** Batches persist in a hidden cache folder (pruned after N days) so reviews can resume, but a resumed batch is treated as stale: every suggestion is re-verified through the resolution tiers on load, and failures flip to `unresolvable`. In-memory batches within one session may use temp-ids; persisted ones may not.

**Undo.** Batch apply takes a document snapshot first; a "Revert auto-tagging" affordance is offered until the next manual edit, after which the snapshot is discarded (reverting later would destroy subsequent edits).

**Schema rules, two layers.** (1) Structural validity from the loaded schema automatically (`schemaManager.isTagValidChildOfParent`, checked against the ancestor chain before insertion; full validation after apply catches rare positional cases). (2) User taste rules — schema-allowed but unwanted, e.g. `<date>` in `<placeName>` — in a settings panel: structured `{ tag, notInside }` with dropdowns fed by the schema, raw-XPath escape hatch for power users. Rules block during auto-tagging, warn during audit. Ships empty.

### Matching performance (the "bombard")

Firing a large authority set (CBDB is ~660k persons) at a document must **not** be done the naive way — iterating dictionary rows and scanning the text once per string (whether via `indexOf` or `re.sub`). That is O(patterns × text): 600k patterns over a 200k-char document is ~10¹¹ character comparisons, minutes to hours, and it recompiles/rescans for every string.

Instead the matcher (`autoTagging/matcher.ts`, `MultiStringMatcher`) does a **single pass** over the text:

- **Build once.** Every pattern is hashed into a bucket keyed by its length (a `Map<length, Set<string>>`). Cost O(Σ pattern lengths), done once and reusable across documents if the dictionary is fixed.
- **Scan once.** Walk the text left to right. At each position, test only the *distinct pattern lengths* (a handful — names are short), doing an O(1) `Set` lookup per length. On a hit, emit it and resume **after** the match (non-overlapping, leftmost-longest — which is exactly the "prefer the longer span" conflict rule). Scan cost is O(text × distinctLengths) — **independent of the number of patterns**.
- **No regex.** Patterns are exact substrings, so there is no regex compilation, backtracking, or escaping — just hash lookups. (This suits CJK, where there are no word boundaries and every position is a candidate start; it is equally correct for whitespace languages via the search-text policy.)

Measured (jsdom, 200k-char text, patterns of length ≤ 6): build 6 ms / 35 ms / 178 ms and **scan 161 ms / 119 ms / 142 ms for 10k / 100k / 600k patterns** — scan time flat as the dictionary grows 60×.

The theoretical optimum is an Aho-Corasick automaton (O(text + matches), also independent of *distinctLengths*). We chose length-bucketed hashing because for short-name dictionaries `distinctLengths` is tiny (≤ ~10), so it is within a small constant of Aho-Corasick while being far simpler and less bug-prone; if a dictionary ever has a wide length spread, swapping in Aho-Corasick behind the same `MultiStringMatcher` interface is a localized change. `dictionaryTag` and the authority seed pass both run through this matcher; the document search-index (normalization, offset map, occurrence counts) is likewise built once per document, not per pattern.

## Base technology

Whatever different methods of autotagging we do, we should use the same set of solid functions for regex, xpath navigation, and validation. I've built such things into sanmiao, so we can look at that package.

Specifically:
- If possible, we insert tags into text nodes to avoid breaking the XML
- We 'deduplicate', removing nested `<persName>` for example.
- We set up schema-based rules to clean tags that go where they shouldn't (e.g., `<date>` inside a `<placeName>`) — checked before insertion where possible.
- After cleanup, we run validation and try to resolve all issues before rebuilding the document and letting the user clean up.

Conflict resolution within a run:
1. Prefer longer span (done)
2. Prefer higher-confidence sources?
3. Prefer known project entities
4. Review of unresolved overlaps

Priority *across* methods (dictionary vs. AI vs. NER on overlapping spans) is set aside for now. The working assumption is sequential passes (e.g., dictionary first, AI audits the result) rather than a competing pool, but no commitment yet.

## East Asian dates

Uses the [sanmiao](https://pypi.org/project/sanmiao/) Python package (tag → solve → report).

**Desktop setup:** for day-to-day hacking, use an [editable install](docs/sanmiao-ljb-integration.md#editable-dev-install-tweak-sanmiao--ljb-together) in a sibling `sanmiao` repo. For a fixed release only: `pip install sanmiao`. LJB calls `python -m sanmiao.tei_bridge` via Electron IPC.

Dates follow a **different workflow** from `persName` dictionary tagging or entity disambiguation. See **`docs/sanmiao-dates-schema.md`** for schema extension details and **`docs/sanmiao-ljb-integration.md`** for sanmiao source-code / namespace notes.

### Why dates are not “tag now, disambiguate later”

- Sanmiao **must** parse structure (`<era>`, `<year>`, `<month>`, …) or numeric attrs on `<date>` before it can solve. A bare `<date>建安十八年二月</date>` is display text until `tag_date_elements` runs again.
- **Resolution attrs** (`era_id`, `jdn`, `when`, …) cannot be written at tag time: proliferate mode returns **one-to-many** calendar candidates per span.
- Ambiguity is **which historical moment**, not which person. Bulk “accept all identical strings” is unsafe for bare relative dates (`三年`).

### Two-phase workflow (Chinese / Japanese)

Dates use **tag first, resolve later** — not one combined pass:

1. **Tag dates** — sanmiao finds spans and writes **parse structure only** inside `<date>` (`<dyn>`, `<era>`, `<year>`, …) with `cert="low"`. No `jdn` / `when` yet.
2. **Manual gap-fill** — add any missed anchors in the editor (e.g. `宋臺初建`) before resolving relatives that depend on them.
3. **Resolve dates** — walk every `<date>` in **document order**, run sanmiao solve with sequential implied context, curate ambiguous picks, apply resolution attributes.

This fixes flashback/relative-date chains that break when the tagger misses a context-setting phrase.

### Integrated tag + resolve (legacy note)

Earlier builds combined tag+solve in one `propose_dates` call. The UI now uses `tag_dates_batch` + `resolve_dates_batch` instead.

### Two layers in corpus XML

| Layer | When | Content |
|-------|------|---------|
| **Parse** | After tag apply (or after resolve if still ambiguous) | Sanmiao children inside `<date>`: `<dyn>`, `<era>`, `<year>`, … — encodes what the text says, **no** `era_id` / `jdn` |
| **Resolution** | After user picks a candidate | `jdn` (canonical), `when` / `notBefore` / `notAfter` (derived ISO for display), optional `era_id`, `dyn_id`, `dila_id`, `calendar` |

Ambiguous or pending: parse children + `cert="low"` (or `type="sanmiao-pending"`). No resolution IDs until confirmed.

**JDN is canonical; ISO is derived.** Project settings store `prolepticGregorian`, `gregorianStart`, `civ`, `tpq`/`taq`. Changing `pg`/`gs` recomputes `when` from stored `jdn` without re-running sanmiao.

### Suggestion object extension

Same `Suggestion` type; dates add optional resolution metadata:

```typescript
interface DateResolution {
  status: 'unique' | 'ambiguous' | 'unresolved' | 'range';
  candidates?: DateCandidate[];
  sequentialContext?: string;
  /** Sanmiao parse XML fragment (inner children only), for apply before resolve */
  parseXml?: string;
}

interface DateCandidate {
  jdn?: number;
  jdnEnd?: number;
  iso?: string;
  isoEnd?: string;
  displayLine: string;   // sanmiao report line
  era_id?: number;
  dyn_id?: number;
  dila_id?: string;
  error_str?: string;
}
```

Resolve UI shows **sanmiao match lines** (not CBDB-style authority cards). No `@key` / `entities.xml` for dates.

### Workflow gate (Chinese / Japanese)

For **Chinese** (`zh*`, `lzh`) and **Japanese** (`ja`) source documents, LJB enforces **dates first**:

1. Auto-tagging opens with **East Asian dates** at the top; dictionary, authority packs, and AI stay disabled until the dates pass completes.
2. **Unlock** when: sanmiao has run on this document in this session (even if zero spans found), or the user applies date tags. Pre-existing `<date>` markup alone does **not** unlock — you must run the dates pass.
3. **Sanmiao is not offered** for Korean or Western-language projects in v1 (other methods are available immediately).

Language is read from **Project settings** metadata first (`profileDesc/langUsage/language`), then the stored TEI header, then the editor document. See `autoTagging/dateWorkflow.ts` and `window.__leafWriterProject.getProjectSourceLanguage()`.

**Planned (Phase 2b):** replace the generic yes/no review for dates with a **date curator** — combined keep/reject, one-to-many picker, and sequential context repair, optionally AI-pre-filled (Phase 2c). See `docs/Auto-tagging-phases.md` § Phase 2b–2d.

### Schema

Stock TEI does not allow sanmiao children or `jdn` / `era_id` on `<date>`. **TEI catalog schemas** (All, Lite, Simple Print, jTEI) are automatically merged on install and patched on project open — see `sanmiao-dates-schema.md`.

## Dictionary tagging

At the very least, we should offer the ability to import tables with 'string' and 'tag' columns. (Despite the historical "regex" label, the implementation uses no regex — see **Matching performance** above; matching is exact-substring via a single-pass length-bucketed matcher, longest span first.)

Sources:
- Spreadsheets (tsv, csv, xlsx, LibreOffice, etc.)
- Internal: crawl project XML to compile an internal list and apply that list
- Authorities: pre-configured occasional dumps from CBDB, DILA, CHGIS APIs (?)

Cut from v1: direct SQL-server connections (connection management, credential storage, user-written queries, streaming). Too much surface area for what is ultimately "get me a two-column list" — the SQL user can export a CSV. Revisit later if there's demand; at most, a "paste a query result" affordance.

## AI mode

Principle: **the AI proposes, the machine applies.** The model never rewrites text. It returns suggestion objects (above); the locator is verbatim string + occurrence index / short context window — not character offsets (unreliable across tokenization) and not model-written regexes (escaping bugs). Verbatim-string-plus-context is trivially verifiable before applying.

**AI suggest**: The user supplies a list of tags. We feed the document (chunked) to the AI with that list; it returns suggestion objects for what it identifies as `<persName>`, etc.

**Provider (2026-07-04, built):** Mistral family only for v1 — a local Ministral model via an Ollama-compatible endpoint for development/no-cost use, hosted Mistral API as the BYO-key fallback. NER is dropped from scope for now (stays in Deferred/future). Frontier-model spend is a later decision if the local/Mistral path proves insufficient. See `autoTagging/llmClient.ts`.

Requirements:
- **Structural, non-overlapping chunking** (`autoTagging/chunk.ts`), not fixed-size-with-overlap: cut only at block-element boundaries (`p`/`div`/`l`/`lg`/`head`/`ab`/`item`), so chunks never split mid-sentence and occurrence counting stays unambiguous (every document offset belongs to exactly one chunk). A read-only context margin surrounds each chunk for disambiguation but is never itself taggable.
- **One pass, multiple tag types**: a single pass should be able to request several tag types at once — this shapes the JSON response format and keeps costs down. Multi-turn refinement (second pass for a tag type) remains possible but is not the default. Suggest, audit, and (later) translation stay **separate prompts/requests** rather than one stacked prompt — a small local model degrades on multi-objective instructions, the output shapes genuinely differ per task, and stacking would invalidate the whole cache whenever any one task's instructions change. They share only a preamble prompt module.
- **Confidence scoring** on every suggestion, filterable by threshold in the review UI.
- **Economy**: cache responses keyed on (chunk hash, tag set, model, prompt version) so re-runs on unchanged text cost nothing (`autoTagging/llmCache.ts`, `.ljb/ai-cache/`, 30-day TTL); batch requests; only send chunks that changed since the last run.
- **Two-layer validation** before anything becomes a suggestion: schema/field validation (`autoTagging/llmParse.ts`: tag/action must be one requested, confidence in [0,1]) and anchor verification against the live document (surface + occurrence must actually resolve). Either failing drops the item silently — never applied, always counted.

**AI audit**: take a dumb-tagged document, identify mistakes with a one-sentence rationale, and walk the user through keep/add/correct decisions:
- dumb mode missed something → `add`
- dumb mode incorrectly identified something as a NE → `remove`
- dumb mode used the wrong tag or drew the boundary incorrectly → `retag` / `redraw-boundary`

These are just suggestion objects with different `action` values, reviewed in the same UI as everything else.

**LLM prompts** (Phase 5 suggest/audit) live as editable text in `packages/cwrc-leafwriter/src/autoTagging/prompt-templates/` — not inline in TypeScript. Bump `versions.json` when wording changes enough to invalidate the AI cache. See **Immediate future** below for the planned UI on top of these files.

### Immediate future (post–first UI wiring, 2026-07)

AI suggest is wired in the desktop app (dialog → review panel → `.ljb/ai-cache/`). Two gaps surfaced immediately after the first live runs: **prompt control for different models**, and **tag types beyond the bootstrap pair**. Both are engine-ready; what is missing is UI, definitions, and harness coverage.

#### A. Prompt profiles — edit, save, and match models

**Problem:** `suggest.v3` was tuned on Groq Qwen3.6-27B (`gold_test.xml`, F1≈0.74). The same prompt regressed on local Ministral 8B; hosted Mistral improved but stayed behind Groq. Users will run different models (Groq, Mistral API, LM Studio) and different corpora (biography vs. cosmology vs. modern Chinese). Prompt text cannot stay one-size-fits-all or developer-only.

**What exists today:**

| Piece | Location | Role |
|-------|----------|------|
| Template files | `autoTagging/prompt-templates/` | `preamble.txt`, `suggest.system.txt`, `tag-definitions.json`, `versions.json` |
| Assembly | `prompts.ts` | Fills `{{TAGS}}`, `{{TAG_GUIDE}}`; exports `SUGGEST_PROMPT_VERSION` for cache keys |
| Connection settings | App Settings → AI API | base URL, API key, model — **not** suggest prompt text |
| Translation-only extra | `customInstructions` in AI API settings | Used by translation; **not** wired to suggest yet |

**What to build (v1 prompt UI):**

1. **Prompt profile storage** — e.g. `.ljb/ai-prompt-profiles.json` (project-scoped) and/or app-level defaults beside AI API settings. Each profile: `{ id, label, modelPattern?, suggestSuffix?, tagGuideOverrides?, version }`.
2. **Profile selection** — on the AI suggest step (and later audit): show active profile; “Edit prompt…” opens an editor. Auto-select profile when `modelPattern` matches the configured model id (e.g. `*qwen3.6*` → “Groq classical biography”).
3. **Layered assembly** (do not let users break the contract):
   - **Locked in code:** locator rules, JSON shape, chunk/context boundaries (`preamble.txt`).
   - **Editable per profile:** task wording, recall/precision bias, corpus genre note (`suggest.system.txt` body or suffix).
   - **Editable per tag:** one-line definitions (`tag-definitions.json` or UI equivalent).
4. **Version bump on save** — any semantic profile change bumps effective `SUGGEST_PROMPT_VERSION` (or a profile-specific suffix in the cache key) so `.ljb/ai-cache/` does not serve stale chunks.
5. **Harness loop** — re-run `validationHarness.live.test` after profile edits; document P/R/F1 in `phase5-validation-results.md` per profile/model pair.

**Out of scope for v1 prompt UI:** stacking suggest + audit in one request; user-editable JSON schema; sharing profiles across projects (export/import can come later).

#### B. Expandable tag types — not only `persName` / `placeName`

**Problem:** The dialog hardcodes two checkboxes (`persName`, `placeName`) because the gold harness and `tag-definitions.json` only cover those tags. Biographical TEI also needs `roleName` (尚書僕射, 侍中), `orgName` (太學), `date`, `title`, etc. — and each project/schema will want a different subset.

**What the engine already supports:**

- `llmSuggest(doc, { tags: [...] })` accepts **any tag name list**; validation only requires the model to return tags from that list.
- **Crawl** already defaults to eight tag types (`persName`, `placeName`, `orgName`, `geogName`, `name`, `roleName`, `title`, `date` — see `DEFAULT_CRAWL_TAGS` in `crawl.ts`).
- **Entity database** maps `persName`, `placeName`, `orgName`, `title` → entity kinds (`TAG_TO_KIND` in `entities.ts`). `roleName` is still an open modeling question (tag in corpus XML, often no standoff entity — see Phase 4a notes).

**What to build (v1 tag picker):**

1. **Schema-driven tag list** — populate the AI suggest checkboxes from the loaded RNG (or a curated allowlist per project: “entity tags this edition uses”). Default selection: project’s most common NE tags, not a global hardcode.
2. **`tag-definitions.json` entries** for each offered tag — at minimum next batch for classical biography:
   - `roleName` — office/rank when referring to a role, not a person name (尚書僕射, 大將軍); distinguish from `persName` when the string is clearly a title.
   - `orgName` — institution (太學, 學官).
   - `date` — explicit dates and reign-period references (defer if schema uses `<date>` differently).
   - `title` — work titles (公羊春秋) when not a personal name.
3. **Gold + harness extension** — extend `gold_test.xml` (or add `gold_test_roles.xml`) with hand-tagged `roleName`/`orgName` examples; measure per-tag P/R before enabling in the default UI.
4. **Per-tag prompt tuning** — expect separate iteration: `roleName` is the main source of persName/placeName confusion in 後漢書-style prose; tune definitions before widening the default checkbox set.

**Principle (unchanged):** one suggest pass, **multiple tag types** in a single request — keeps cost down and matches the JSON response shape. Do not default to one API call per tag type unless a tag family needs a wholly different prompt (possible later for `date`).

**Done when (these two items):** user can pick tags from schema/project settings; active prompt profile is visible and editable without touching repo files; profile + tag set participate in cache keys; harness documents quality for at least Groq Qwen3.6 + one Mistral path on gold that includes `roleName`/`orgName`.

**Auto-accept rules**: let users define per-tag trust (e.g., "auto-accept AI `<date>` suggestions above 0.9, always review `<persName>`").

**Authority packs & tag bomb (2026-07-05):** the primary throughput path for tagging quantity is offline **authority packs** (CBDB, DILA, Wikidata subsets, GeoNames, NDL, …) compiled to match strings and fired through the dictionary/seed matcher — not LLM suggest. AI remains the long-tail supplement. Strategic plan and source feasibility: [authority-packs-planning.md](authority-packs-planning.md).

**User feedback**: no trained classifier. A simple decision log (surface form → chosen tag/entity, with counts) in the project entity file gets 90% of the value: it drives defaults ("user corrected 張衡→persName twice, so default to that") and doubles as context for AI ranking.

## NER

The user would supply a language model (?), but this would depend on the language.... the user should do that himself. Future. When it comes, it emits suggestion objects like everything else.

## UI

This is not something that the user will do all the time, so we should maybe handle this with a big popup accessible through a button on the central panel. The review walk itself uses the shared split-screen review UI.

---

# Disambiguation

## Data model

We distinguish:
1. **surface form**: 張衡 as written in the text;
2. **mention**: this specific occurrence of 張衡;
3. **entity**: the person/place/work to which it refers;
4. **authority links**: CBDB, Wikidata, VIAF, DILA, CHGIS, etc.

TEI mapping, explicitly:
- surface form = text content;
- mention = the element (`<persName>` etc.);
- entity = `@key`/`@ref` on the mention, pointing **only to the local project entity** — never directly to an external authority;
- authority links live on the entity record. This keeps the XML stable when authority mappings change.

## Entity file (the "database")

Not an SQL server. The entity database is a TEI standoff file: `<standOff>` / personography / placeography (`<listPerson>`, `<listPlace>`, ...) with `xml:id`s as local ids and `<idno type="CBDB">`, `<idno type="wikidata">`, etc. for authority links, plus description fields and cached authority data.

**Default: one shared database per user**, not one per project. This matches Norbert's personal SQL database — you disambiguate 張衡 once and reuse that entity across every text you work on. Projects opt in to a **project-local** database only when they need an isolated entity pool (teaching sandbox, experimental fork, etc.).

### Where things live

| Artifact | Location | Visible? |
|----------|----------|----------|
| Central entity database | `{user-chosen folder}/entities.xml` | Yes — open in any TEI editor |
| Project entity database (opt-in) | `<projectRoot>/entities.xml` | Yes |
| Decision log, pending caches, project backups | `<projectRoot>/.ljb/` | Hidden |
| App prefs (central DB folder path, etc.) | Electron userData | Hidden |

**Central database folder** — chosen at **first-run / install** (folder picker, not file). LJB explains: this folder holds your **entity database** (`entities.xml`); we **suggest** keeping your projects as subfolders here, but that layout is optional. Changeable in **App Settings → Entity database location**. Pointer-only on move (no automatic file migration) + strong warning.

**Project-specific database** — opt-in at new-project setup or in **Project → Project settings** (renamed from "Edition metadata"). Writes `<projectRoot>/entities.xml`.

**Decision log** — always per-project at `<projectRoot>/.ljb/entity-decisions.jsonl`. Not shared (projects differ in scope, period, etc.). Other LJB-internal clutter (pending suggestion cache, import run logs, project Time Machine snapshots) also lives under `.ljb/`. No LEAF / `.leaf` branding anywhere in this stack.

### Example layout (optional, user-defined)

```
~/Documents/XML corpus/           ← folder chosen at install
├── entities.xml                  ← central database (visible)
├── my-han-texts/                 ← project using central database
│   ├── jean-baptiste.project.json
│   ├── .ljb/
│   │   ├── entity-decisions.jsonl
│   │   └── time-machine/         ← project snapshots (planned)
│   └── chapter1.xml
└── teaching-sandbox/             ← project with its own database
    ├── jean-baptiste.project.json
    ├── entities.xml
    ├── .ljb/
    └── exercise1.xml
```

### How the app picks which entity file to use

No directory walking. Resolution is explicit:

1. **App Settings** stores the central database **folder**; file is always `{folder}/entities.xml`.
2. **Project settings** (`jean-baptiste.project.json`) stores `"entityStore": "central"` (default) or `"entityStore": "project"`.
3. If `"central"` → read/write App Settings path. If missing → prompt (see **Recovery** below).
4. If `"project"` → read/write `<projectRoot>/entities.xml`.

**On every project open:** if the project JSON has no `entityStore` settings yet, open **Project settings** automatically (same dialog as first-time metadata setup).

Mentions use bare local ids (`key="person-000001"`). Which file holds that id is resolved from project settings + app prefs, not encoded into each mention.

### Database identity & mismatch warnings

Each `entities.xml` carries a stable **database id** in its TEI header (e.g. `<idno type="ljb-entity-database">` with a UUID, set at creation). The project JSON stores `entityDatabaseId` — the id of the database this project was last linked to.

On open (and before any entity write), LJB compares the resolved database file's id to the project's stored id. **Mismatch → warn:** the corpus `@key` values were created against a different database; ids will not match. Default action: **Cancel** (stay disconnected until resolved).

When the user changes App Settings to point at a different folder, or switches `entityStore` mode, treat it as a potential mismatch and run the same check.

### Database file validation (safety)

Before reading or writing, LJB verifies the target file is an entity database:

- TEI standoff with expected structure (`<standOff>`, entity lists), **and**
- A hard-coded marker in the file (subtype / `idno type="ljb-entity-database"`) that LJB sets in the scaffold.

If the user points App Settings at an ordinary TEI text file, refuse and warn. This prevents corrupting corpus XML by mistake.

### Missing or lost central database

If App Settings points at a folder where `entities.xml` is missing:

1. **Prominent warning** — your entity database was not found; disambiguation is blocked until resolved. Emphasize: **do not lose this file**; back it up (Time Machine tab — see below).
2. **Find existing** — file picker to locate a previously created `entities.xml`.
3. **Create new** — scaffold a fresh empty database in the configured folder (or a newly chosen folder).

If the corpus already contains `@key` values but the database is gone:

| Option | What it does |
|--------|----------------|
| **Purge all entity ids** | Strip `@key` only from all corpus files in the project; **keep tags** and all other attributes (`@resp`, `cert`, etc.). User re-disambiguates from scratch. |
| **Reconstitute from corpus** | Crawl all `@key` values in the project; mint **stub** entity records (id + name from the tagged surface text). Preserves id continuity in the XML but **cannot restore** authority `<idno>` links or descriptions that lived only in the lost file. |

Use **reconstitute** when the database file is lost but the XML still has keys. Use **purge** when you want a clean slate with no keys.

### Voluntary database switch (central ↔ project, or different central path)

What matters is **not** preserving LJB local ids (`person-000001`) — those are disposable handles. What matters is preserving **relationships and authority links**:

- these mentions pointed at the same entity (shared old `@key`);
- that entity's names, descriptions, and **`<idno>` authority links** (CBDB, Wikidata, your own database ids, etc.).

**Yes, this is doable.** When switching databases and the **old** `entities.xml` is still available:

1. **Import entities** from old database → target database. For each entity referenced in the project (or the full old file — user choice):
   - Copy names, notes, descriptions, and **all `<idno>` elements** (including custom types for the user's own authority ids).
   - **Do not** copy old `xml:id` values — mint fresh local ids in the target (or match an existing entity in the target if it already has the same authority `<idno>`, to avoid duplicates).
2. **Build a remap table** oldLocalId → newLocalId from that import.
3. **Rewrite corpus `@key` values** using the remap table so every mention still points at the correct imported entity.
4. Update `entityDatabaseId` in the project JSON.

After import, old LJB ids are gone from both the database and the corpus; authority links and mention↔entity groupings are preserved.

**Mismatch dialog options:**

| Option | When |
|--------|------|
| **Cancel** (default) | No change. |
| **Import from previous database** | Old `entities.xml` available (file picker if needed). Import + remap as above. |
| **Purge all entity ids** | Strip `@key` only; keep tags and all other attributes. Attach to new empty or existing target database. |

Do **not** silently keep stale keys. **Reconstitute** (stub entities from corpus surface text) remains for **lost-database** recovery when the old file is gone — it cannot restore authority `<idno>` links.

**Import without corpus remap** (e.g. merging two database files in App Settings): same entity-import logic, deduplicating on authority `<idno>` where possible; no corpus rewrite. Deferred as a separate "merge databases" action if not needed for v1 project switch flow.

### External edits & reload

A file watcher on the active `entities.xml` detects changes made outside LJB. Prompt: **"Database changed externally — reload?"** Reload before the next entity operation if the user confirms.

### Incremental ids (SQL-equivalent behaviour)

Local ids (`person-000001`, `place-000002`, …) are generated by scanning all existing `xml:id` values of that type in the database file, taking the highest numeric suffix, adding one, and skipping any collision. Ids are **never derived from names**. This is the same guarantee SQL auto-increment gives you:

- **Monotonic** within a type — each new entity gets a fresh number.
- **Non-duplicating** — collision loop ensures uniqueness even if the file was hand-edited or merged oddly.
- **Stable** — once `person-000042` is written into a corpus `@key`, that string stays meaningful as long as the same database file is attached.
- **Per-database** — ids are unique within one `entities.xml`, not globally across files. That is why the database-id fingerprint matters.

The only way ids "break" is attaching a corpus to a different database (handled by mismatch warnings) or manual hand-editing that reuses an id for a different person (same risk as editing an SQL table by hand — rare, user-owned).

Machine provenance on auto-linked mentions: `resp="#ljb-autotag"` (replacing `#leafwriter-autotag`). Authority-cache notes: `resp="le-jean-baptiste"`.

### Time Machine backups

Time Machine gains a **second tab** for the **central entity database**:

- **Project tab** — corpus snapshots under `<project>/.ljb/history/` (unchanged).
- **Entity database tab** — snapshots of `entities.xml` stored in the **hidden app folder** (Electron userData, alongside cache and settings). Same hash-dedup rules as corpus saves.
- The Time Machine popup lets the user **delete individual snapshots** (both tabs).
- Project-local `entities.xml` (when `entityStore: "project"`) uses the Project tab scope under that project's `.ljb/history/`.

Strong reminder in UI: back up your entity database; it is the disambiguation work of a lifetime.

### Corpus operations & exclusion

Project-local `entities.xml` must be excluded from find/replace, auto-tag crawls, and validation. Hidden `.ljb/` is excluded by the reserved-path mechanism. The central database lives outside the project tree and is never enumerated.

### Deferred (not v1)

- **Standalone database merge** — combine two entity files without an attached project/corpus (same import logic as voluntary switch; lower priority if project switch covers the main use case).
- **SQLite runtime index** for very large central files (XML remains source of truth).
- **Multi-machine sync** — two LJB instances editing the same `entities.xml` concurrently.
- **Migration tooling** from early `.leaf/entities.xml` prototype paths in test projects.
- **Move-file wizard** when changing central DB folder (v1 = pointer update + warning only).
- **Entity database viewer/editor** UI beyond opening the XML externally.

## Norbert paradigm (reference)

In Norbert, I have an SQL database that is my own. First I tag entities, then I add attributes. If there is a one-to-one correspondence, I add that attribute. If it is one-to-many, I add all, separated by `|`. After the first round of tagging, I export a CSV that lists all those individuals that matched with related information (dynasty, where he might have a biography, description, _zi_, etc.). Then:
- Where there is a one-to-one match that is wrong, necessitating the addition of a new person, I remove that item from the table.
- Where there is a one-to-many, I manually deduplicate, leaving only the correct person.
In phase two, I clean the XML attributes based on the table, and those without attributes are exported to a new table, of people to add, which I validate before sending off to the SQL database, getting their new IDs, and then inserting them as attributes.

This works great for me, but I'm not going to set up such a thing for every user. (A future option: let a power user connect his own database — later step, not for everyone.)

## Workflow

When we disambiguate, it will open a version of the 'entities' panel. We'll select what tag we want to disambiguate (`<persName>` only, for example). Each unique string will expand into a tree with instances of that unique string. These can be clicked or keyboard navigated like with find, so that we can immediately see where it is in the text.

When we launch that, we'll query the authorities the user has chosen, the local entity database, and any offline dumps (CBDB, DILA, etc.). **Grouping rules:**

1. If the local entity file already links authority ids, hits matching those ids **auto-merge** into one candidate.
2. Cross-authority indexes (e.g. Wikidata → VIAF) collapse matching proposals.
3. The user can **manually link** two proposals (Wikidata + VIAF) to one local entity; both `<idno>` entries are stored — multiples of the same type allowed.
4. Each proposal shows a **source icon**; linked/merged proposals show **stacked icons**.

Each item provides basic details to help disambiguate. Button to open the authority source (e.g. Wikipedia).

**Buttons:**
- accept for this occurrence;
- accept for all identical strings **in this document** (default bulk — never corpus-wide);
- create new entity;
- mark unresolved (`cert="unknown"`, no `@key`, red styling — candidates kept in `.ljb/`);
- ignore (X on the tree, moves to the bottom of the list);
- split group.

**Re-running disambiguation:** each pass is incremental. Mentions with `@key` appear as already done (filter hides them by default). Ambiguous mentions (`cert="unknown"`, no key) and untagged/unkeyed mentions stay in the queue. **Never** auto-purge keys on re-run — purge is manual only.

A filter button at the top of the panel filters out strings in which all instances have ids.

When the author accepts and the entity has no custom description, a popup offers an **optional** free-text note. Pre-fill dates/one-liner from authority when available. Everything optional ("the cheese guy" is fine).

### Live authority lookup (Phase 4b)

**v1 strategy:** reuse the **LINCS reconcile API** (already in the app) for VIAF, Wikidata, DBpedia, GeoNames, Getty, GND. **Offline only** for CBDB, DILA, CHGIS, and personal SQL/CSV exports.

**Politeness:** cache in `<project>/.ljb/authority-cache/`; query when a string is opened, not on every keystroke; ~1 request/second max; 30-day TTL + manual refresh; User-Agent identifies Le Jean-Baptiste. See `Auto-tagging-phases.md` Phase 4b for the full authority matrix.

Technical:
- cache authority queries;
- batched reconcile calls (multi-authority per request via LINCS);
- rate limit, to be polite.

**LLM prompts** (Phase 5 suggest/audit) live as editable text in `packages/cwrc-leafwriter/src/autoTagging/prompt-templates/` — not inline in TypeScript. Bump `versions.json` when wording changes enough to invalidate the AI cache.

## AI-assisted ranking

We will also integrate AI via API to provide guided choices with a short summary as to why for each case. It draws on the project entity file, cached authority data, and the decision log:

- date range;
- genre;
- nearby names;
- known corpus topic;
- place context;
- dynasty/period words;
- already-resolved entities;
- user's past decisions (the decision log).

The AI outputs a ranking to help the reader make a quick decision, e.g.:
```
1. 張衡, Eastern Han astronomer — likely, because nearby text discusses calendrical instruments.
2. 張衡, Tang official — unlikely, date mismatch.
```
He can click, accept locally or for the whole document, as above. Same caching/batching economy rules as AI mode.

## Anchoring

Disambiguation choices are suggestion objects too, using the same anchor scheme. Within a session, temporary ids on affected nodes are simpler and more robust than re-locating; flush them when we move out of disambiguating that tag-type. Cross-session re-anchoring (via the surface + context + hash fields) is deferred.

# Database

Entity database viewer/editing tools deferred (see **Deferred** in `Auto-tagging.md`). Users open `entities.xml` directly in LJB or any TEI editor.
