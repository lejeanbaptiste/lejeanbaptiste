# Ctext import — planning

**Status (2026-08-28):** **Not started** (full import path) — **wiki fetch for parallel punctuation is done** via the Kanripo plugin (`fetch-ctext-parallel.mjs`, segmented mode in `parallel_punct.py`). A standalone **File → Import from Ctext…** path remains deferred.  
**Related:** [kanripo-import-plugin-planning.md](kanripo-import-plugin-planning.md) (Kanripo clone + parallel punct; ctext wiki as parallel source), [daozang-import-planning.md](daozang-import-planning.md) (bundled Dao parallels), [import-planning.md](import-planning.md) (generic document import), [corpus-extraction-planning.md](corpus-extraction-planning.md) (web extract patterns).

Ctext (Chinese Text Project) is a major pre-modern Chinese corpus. Grognard already uses ctext **wiki pages** as punctuated parallels when importing Kanripo texts (李善-style inline commentary). This document plans a future **direct import** path: pull text from ctext into project TEI without going through Kanripo first.

---

## Goal

When implemented, the user should be able to:

1. Open **File → Import from Ctext…** (or a parallel entry inside an expanded “Import corpus” menu).
2. Search or paste a ctext link / URN / title.
3. Choose scope (chapter, section, whole work where permitted).
4. Import into the open project as **schema-valid TEI** (one file per chapter or per user-chosen unit).
5. Optionally attach **wiki parallel punctuation** (segmented mode) if the imported text is unpunctuated or Kanripo-like.

Two distinct use cases share infrastructure but not the same source:

| Use case                   | Source                      | Typical output                                                                                    |
| -------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| **A. Plain text import**   | CTP JSON API (`gettext`)    | Unpunctuated or lightly punctuated paragraphs in TEI                                              |
| **B. Punctuated parallel** | Ctext wiki HTML (李善 etc.) | Plain text with `<span class="inlinecomment">` — fed into parallel punct, not stored as final TEI |

Use case B is **partially done** via `fetch-ctext-parallel.mjs` and the Kanripo import wizard (“Fetch from ctext”). Use case A is the main subject of this plan.

---

## Why not scrape ctext.org at scale?

The site terms and API docs discourage bulk automated download outside the API. For production import we should use the **official JSON API** ([tools/api](https://ctext.org/tools/api/ens)), not HTML scraping of reading pages or wiki tables.

Wiki scraping remains acceptable for **small, user-initiated parallel fetch** (one chapter row or section at a time), which is what we do today.

---

## Ctext API — what it provides

### Core functions (relevant to import)

| Function             | Purpose                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `gettext(urn)`       | Return `title`, `fulltext` (paragraph list), and/or `subsections` (child URNs) |
| `readlink(url)`      | Resolve a https://ctext.org/… URL to a CTP URN                                 |
| `getlink(urn)`       | URN → browser URL                                                              |
| `searchtexts(query)` | Find works/chapters by title                                                   |
| `getstatus`          | Auth tier and rate-limit state                                                 |

Official Python wrapper: [pypi.org/project/ctext](https://pypi.org/project/ctext/) (`gettext`, `gettextasparagraphlist`, `gettextasstring`, `setapikey`).

### Response shape (textual data)

Pass a **CTP URN** (opaque identifier, e.g. `ctp:analects/xue-er`). Do not parse URNs client-side; treat as opaque.

- **Chapter-level URN** → usually returns `fulltext`: ordered list of paragraph strings.
- **Book-level URN** → usually returns `subsections` (list of child URNs) **if authenticated**; otherwise `ERR_REQUIRES_AUTHENTICATION`.

### Authentication and limits

| Tier                           | Access                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| Anonymous                      | Limited data; chapter requests may work; whole-book structure often blocked |
| Logged-in CTP account          | Higher request quota                                                        |
| Institutional IP / **API key** | Full structure traversal, larger downloads                                  |

Errors to handle in UI: `ERR_REQUIRES_AUTHENTICATION`, `ERR_REQUEST_LIMIT`, `ERR_INVALID_URN`, `ERR_UNDEFINED_URN`.

API keys are set once per session (`setapikey`) and sent with subsequent calls. Grognard should store an optional key in **project or app settings** (same pattern as AI / LanguageTool), never in committed files.

### What the API does _not_ give us (today)

- **Structured inline commentary** (李善-style interleaving) in `fulltext` — commentary on wiki pages is editorial markup, not API fields.
- **Kanripo page breaks** or Mandoku `(…)` conventions.
- **TEI** — only plain paragraphs.

So: API import → TEI wrapper + `<p>` per paragraph; punctuation from wiki → separate parallel-punct step (already built for Kanripo bodies).

---

## Decisions (provisional)

| Topic                 | Proposed decision                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin vs host-only   | **New hybrid plugin** `plugin-ctext-import` (mirror Kanripo), or extend `plugin-kanripo-import` with a second menu item — decide when scoping; separate plugin keeps Kanripo bundle smaller. |
| Granularity           | Default **one XML file per API chapter** (`fulltext` unit). Whole-book import = recursive `gettext` + one file per subsection.                                                               |
| Text encoding         | UTF-8 throughout; API returns Unicode.                                                                                                                                                       |
| Punctuation on import | **As-is from API** by default; optional “Fetch wiki parallel + segmented punct” if user supplies wiki chapter URL.                                                                           |
| Provenance            | `sourceDesc` / `revisionDesc`: CTP URN, ctext URL, import date, API vs wiki parallel if used.                                                                                                |
| Rate limits           | Queue requests; show progress; respect `getstatus`; fail with clear message on `ERR_REQUEST_LIMIT`.                                                                                          |

---

## User-facing flow (target)

### Import wizard

1. **Find text** — search box (local cache of `searchtexts` results or live API); or paste `https://ctext.org/…` → `readlink` → URN.
2. **Pick scope** — tree or list from `subsections` (requires auth for books); or single chapter if user landed on a chapter URL.
3. **Options**
   - Output folder under project (e.g. `imported/ctext/<slug>/`).
   - Optional **wiki parallel URL** + section name → run segmented parallel punct after TEI wrap (same engine as Kanripo).
   - Optional API key (if not already in settings).
4. **Preview** — paragraph count, first/last paragraph snippet, estimated file count.
5. **Run** — fetch paragraphs, wrap TEI, write files, validation report.

Requires an **open project** (same as Kanripo / document import).

### Relationship to Kanripo workflow

Many DH projects will **continue to import Kanripo** (page breaks, critical apparatus) and use ctext wiki only as punctuation source. Ctext import targets:

- Works **not on Kanripo** but on ctext.
- Quick chapter pulls for comparison or teaching.
- Prose texts where page breaks matter less than readable punctuation.

---

## Architecture (sketch)

```
User query / URL
      │
      ▼
 readlink / searchtexts  ──► CTP URN
      │
      ▼
 gettext (recursive if book)  ──► paragraph lists per chapter
      │
      ▼
 TEI skeleton (project schema) + teiHeader (title, URN, sourceDesc)
      │
      ├── optional: wiki fetch (existing ctext-wiki-parallel.mjs)
      │         └── parallel_punct mode=segmented (existing Python)
      │
      ▼
 write XML → validate → report
```

| Layer                                  | Where (proposed)                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| Manifest, optional bundled title index | `plugins/packages/plugin-ctext-import/`                                       |
| Python: API client thin wrapper        | plugin Python (wrap `ctext` PyPI or raw `api.ctext.org` JSON)                 |
| JSON bridge                            | extend pattern of `grognard_bridge.py` (`op: "ctext_gettext"`, etc.)               |
| Wiki parallel fetch                    | **Reuse** `scripts/ctext-wiki-parallel.mjs` + `ctextWikiParallel.ts` IPC      |
| Wizard UI                              | Grognard host module (like `kanripoImportUi`)                                      |
| HTTP to API                            | **Main process** (no CORS; centralise rate limiting and API key)              |
| TEI wrap                               | Reuse `buildSkeletonForCatalog` / `kanripoImportXml`-style provenance helpers |

Import writes **files on disk**; no TinyMCE round-trip.

---

## Reuse map

| Piece                    | Location                                                                                         | Role                       |
| ------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------- |
| TEI skeleton + metadata  | `schemaTemplates.ts`, document import                                                            | Wrapper                    |
| Wiki row/section fetch   | `plugin-kanripo-import/scripts/ctext-wiki-parallel.mjs`, `apps/desktop/src/ctextWikiParallel.ts` | Parallel source (case B)   |
| Segmented parallel punct | `plugin-kanripo-import/python/parallel_punct.py`                                                 | Optional post-import punct |
| Python plugin IPC        | `pluginPythonBridge.ts`, `plugins:invokePython`                                                  | Long jobs                  |
| File menu contribution   | plugin manifest `fileMenu`                                                                       | Entry point                |
| Validator                | `cwrc-leafwriter-validator`                                                                      | Post-import check          |

---

## Phasing

### Phase 0 — Settings + spike

- App/project setting: **CTP API key** (optional).
- Main-process spike: `readlink` + `gettext` for one known chapter URN; log paragraph count.
- Document error-code handling in a table for UI messages.

**Acceptance:** With a valid key, one chapter imports as a JSON paragraph list in a dev script; without key, chapter-only public URNs still work where API allows.

### Phase 1 — Chapter import to TEI

- Wizard: paste chapter URL or URN → single TEI file in project.
- Header: title from API, `idno type="CTP"`, source URL.
- Body: one `<p>` per `fulltext` paragraph (minimal escaping).

**Acceptance:** Import `ctp:analects/xue-er` (or equivalent) into an open teiLite project; file validates; provenance recorded.

### Phase 2 — Search + multi-chapter

- `searchtexts` in wizard.
- Book URN → enumerate `subsections` (requires key) → one file per chapter; progress bar.

**Acceptance:** Import all chapters of a small work (e.g. 論語); N XML files; rate limit respected.

### Phase 3 — Wiki parallel hook

- Optional field: wiki chapter URL + section.
- After TEI body built, run **segmented** parallel punct if user enabled (reuse Kanripo engine; map body to same segment structure or import as plain text first).

**Acceptance:** Import unpunctuated API chapter + wiki 李善 section → overlapping stretch gets punctuation stamps (`ana="grognard:parallel-punct"`).

### Phase 4 — Polish

- Cached URN/title index for offline search (optional).
- `revisionDesc` merge when re-importing same URN.
- Link from entity / passage citations to CTP URNs ([live-passage-citation-planning.md](live-passage-citation-planning.md)).

### Deferred

- Full wiki-to-TEI (commentary as `<note type="comm">`) without a Kanripo-like base text.
- Automatic pairing of Kanripo KR ids with ctext URNs.
- Bulk download of entire ctext (forbidden / impractical; not a goal).
- AI punctuation on ctext imports (reuse Kanripo Phase 4 AI path if ever built).

---

## Overlap with Kanripo plugin (current state, 2026-08-28)

Already shipped in `plugin-kanripo-import`:

- `merge_split_comm_notes` + `apply_parallel_segmented` for basetext/commentary alignment.
- `fetch-ctext-parallel.mjs` / `ctext-wiki-parallel.mjs` with `--section`, `--contains`, `--list-sections`.
- Kanripo wizard: **Fetch from ctext**, **List sections**, **Segmented** alignment mode.

Not shipped:

- CTP API `gettext` import path.
- Ctext search/browse wizard.
- TEI header conventions for CTP URNs.

When Ctext import is built, **do not duplicate** wiki fetch or segmented punct — call the same modules.

---

## TEI / metadata conventions (draft)

- `titleStmt/title` — from API `title`.
- `publicationStmt` — project edition metadata (unchanged).
- `sourceDesc/bibl` — Chinese Text Project; URL from `getlink`; CTP URN in `idno type="CTP"` or `ana`.
- `revisionDesc/change` — import timestamp, plugin id, API key used (yes/no, not the key), wiki parallel URL if any, punct mode.

Page breaks: API paragraphs do not include Kanripo-style `<pb/>`. Optional future: map paragraph boundaries only, or leave unpaginated.

Commentary: if imported from API only, there is no commentary. Wiki-sourced punctuation does not automatically create `<note type="comm">` unless we add a separate segmentation pass (hard; defer).

---

## Test fixtures

1. **Public chapter** — small `fulltext` (e.g. 學而) for Phase 1 without API key.
2. **Book with subsections** — requires key; assert subsection list length matches file count.
3. **Invalid URN** — `ERR_UNDEFINED_URN` surfaces in wizard.
4. **Rate limit** — mock or low quota account → user-readable error.
5. **Wiki parallel** — 文選 兩都賦序 wiki section + segmented punct on a Kanripo or API body (integration with existing tests).

---

## Open questions

1. **Separate plugin** (`ctext-import`) vs menu item on Kanripo plugin?
2. Where to store API key — app-wide vs per-project secrets file?
3. Default file naming: URN slug (`xue-er.xml`) vs Chinese title (collision handling)?
4. Import **wiki table text** as primary source (punctuated + commentary in spans) vs API plain text only — wiki HTML is not stable API; prefer API for primary TEI, wiki for punct overlay.
5. Simplified vs traditional: ctext UI language parameter (`if=gb` vs `if=gb`) — expose in wizard?
6. Institutional users: document IP allowlisting vs key for universities.

---

## Suggested first implementation slice

Phase 0 spike in main process: settings field for API key, one IPC handler `ctext:gettext(urn)`, dev-only button or CLI that writes paragraphs to stdout. No wizard until `readlink` + `gettext` error handling is solid. Reuse wiki parallel + segmented punct unchanged for Phase 3.
