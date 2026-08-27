# Kanripo import plugin — planning

**Status (2026-08-27):** **Phase 1 shipped** — File → Import from Kanripo… (when the plugin is enabled), git clone/flush, as-is TEI per juan, optional DPM / hard-replacements normalisation. Conversion lives in `normalization_zh.kanripo_tei` (`convert_kanripo_txt`); **do not** use `segment_kanripo_document` for this path (it strips `<pb>` and notes for text-reuse matching). Parallel punctuation, coverage bar, and AI are not in this phase.  
**Related:** [import-planning.md](import-planning.md) (blind/profiled file import; Mandoku sample), [corpus-extraction-planning.md](corpus-extraction-planning.md) (Wikisource / web extract, later), plugin host in `plugins/` (`cjk-dates`, `norbert`).

This plugin clones a Kanseki Repository (Kanripo) work from GitHub, converts each juan to project TEI, and optionally segments/punctuates. Segment-and-punctuate is also an editor command for a selection that has no punctuation.

---

## Goal

When the plugin is enabled:

1. **File → Import from Kanripo…** opens a wizard.
2. The user searches by **text number** (`KR1a0145`) or **title**, selects a work, and LJB clones that GitHub repo.
3. Each Kanripo `.txt` (one **juan**) becomes one **TEI XML** file in the open project.
4. Conversion always: TEI skeleton for the current project schema, Kanripo metadata in the header, `<pb/>` milestones, `(…)` → `<note type="comm">`.
5. Optional: character normalisation (user picks a table).
6. Optional punctuation (per work, then reusable in the editor):
   - leave as unpunctuated lines (pilcrow joining only);
   - segment and punctuate from a **parallel transcription** (file, paste, or URL; may cover only part of the juan);
   - segment and punctuate via **AI** (JSON insertions; do not rewrite characters).

Clones are **temporary**: cache while converting, **delete the git tree** once XML is written. XML is the keepable artifact.

---

## Decisions (2026-08-27)

| Topic | Decision |
| --- | --- |
| Granularity | **One XML file per juan** (one per Kanripo `.txt`). |
| Git tree | Clone to a cache/temp dir; **flush after successful XML write**. On conversion failure, keep the clone until retry or cancel. Re-import clones again. |
| Commentary | ASCII `(…)` → `<note type="comm">…</note>` inline (including across `<pb/>`). |
| Normalisation | User chooses **off** / **hard replacements** (`hard_replacements.csv`) / **older DPM variant table** (`dpm_variant_normalisation_table.csv`). Record which in `revisionDesc`. |
| File menu | **File → Import from Kanripo…** (next to Import Documents). Segment-and-punctuate also in the **editor** (toolbar / Tools). |
| Parallel source | Any extractable document, **paste**, or **URL** (Wikisource especially). Punctuate only the overlapping stretch. Coverage shown as a **1-D bar** (disk-usage metaphor) per juan. |

---

## User-facing flow

### Import wizard (one modal, stepped)

1. **Search** — field accepts a KR id or a title substring; results show `KR_ID`, title, author/dynasty when known. Index shipped with the plugin (from `chinese_corpus_metadata` `krp_works.csv` or equivalent), searched locally.
2. **Clone** — progress (git). Destination: app cache, not the project folder.
3. **Convert options**
   - Normalise: off / hard replacements / DPM table.
   - Commentary notes: on by default.
   - Punctuation: as-is / parallel / AI.
4. **If parallel** — add one or more sources (file, paste, URL). Coverage bars update. Apply.
5. **If AI** — uses the project’s configured OpenAI-compatible endpoint; JSON insertions only.
6. **Run** — per-juan progress; write under e.g. `imported/kanripo/KR1a0145/`. Single-juan may open the first file; large works do not dump dozens of tabs.
7. **Report** — files written, failures (unbalanced `()`, no `<pb>`, alignment below threshold, validation). Then **delete the clone**.

Requires an **open project** (schema + metadata), same as New File / Import Documents.

### Editor command: Segment and punctuate…

Same parallel/AI engines, no Git. Tape = current document or selection. Coverage bar, then apply only to green ranges. Lets the user finish a juan that Wikisource only half-covered, later, without cloning again.

---

## Architecture

```
search index (bundled) ──► pick KR_ID
                              │
                              ▼
                     git clone (main process / plugin Python)
                              │
                              ▼
              per .txt: Mandoku → TEI body + header
                              │
              optional: normalise (chosen table)
                              │
              optional: parallel sources and/or AI JSON
                              │
                              ▼
              write XML into project  ──► flush clone
```

**Package shape** (same as `cjk-dates`): hybrid plugin.

| Layer | Where |
| --- | --- |
| Manifest, work index, normalisation CSVs, Python conversion | `plugins/packages/plugin-kanripo-import/` (name TBD) |
| Thin `register.mjs` | plugin package |
| Wizard + coverage UI | LJB host module (`loadHostModule`), so the plugin does not bundle React |
| File menu injection, git clone IPC, fetch URL, write files | desktop main process |
| Python IPC | existing `plugins:invokePython` (needs a longer timeout and non-Sanmiao-specific resolver) |

Import writes **files on disk** (like `documentImport.ts`). It does not round-trip through TinyMCE.

---

## Host changes (lejeanbaptiste)

Plugins today may declare `contributions.toolsMenu` only. The Electron **File** menu is hard-coded. Tool actions can be *dispatched* if a menu click sends them, but plugin items are not inserted into File.

Needed:

1. **`fileMenu` (or generic host-menu) contribution** in the plugin manifest schema; rebuild `Menu.setApplicationMenu` when plugins enable/disable. Item visible only when this plugin is enabled.
2. **Git clone IPC** — `git clone --depth 1 https://github.com/kanripo/<KR_ID>` into a cache dir; progress; abort. Do not clone in the renderer.
3. **HTTP fetch IPC** for parallel URLs (no CORS in the editor). Optional Wikisource path: MediaWiki parse API instead of scraping chrome.
4. **Python bridge** — jobs longer than five minutes; progress events (already used by `cjk-dates`); interpreter check must not assume Sanmiao.
5. **Write imported XML** into the project tree (reuse explorer file ops / import output-path helpers).
6. **Host UI module** for the wizard and coverage bar.

### Clone cache

- Location: user cache (e.g. under the app’s userData), keyed by `KR_ID`.
- Lifecycle: create → convert all juans → on full success, `rm -rf` the clone. Partial failure: keep clone, show report, retry without re-downloading.
- Project stays small; XML is the only lasting output.

---

## Conversion (always)

Target is **current project TEI**, not the old Daozang `<metadata>`-inside-`<body>` documents from `dz_krp`.

Reuse **body** logic from Mandoku / `dz_krp`; wrap with `buildSkeletonForCatalog` (or the same header merge as document import).

### Mandoku / Kanripo plaintext

Typical file: org-mode header (`#+TITLE:`, `#+PROPERTY: ID|JUAN|SOURCE|DZID|…`), then `<pb:KR1a0145_WYG_002-1a>` lines, `¶` end-of-line marks, `**headings**`, `(interlinear notes)`.

Rules (also the Phase 2 acceptance case in [import-planning.md](import-planning.md) for `KR1a0145_002.txt`):

- Drop `#…` header lines from the body; map them into `teiHeader`.
- `<pb:…>` → `<pb n="…"/>`. Page breaks sit **inside** `<p>`; they do not start a new paragraph.
- `¶` = end of line. **Missing** pilcrow = the paragraph continues across the page break (join lines).
- As-is mode: one `<p>` per joined line/paragraph; no extra `。，、`.
- `**…**` → `<head>` when it is a heading line (schema-checked; fall back to `<p>` if invalid).

### Header / provenance

Merge project edition metadata (same as New File). Per-file extras:

- `titleStmt/title` from `#+TITLE` (else filename).
- `idno type="Kanripo"` = work id; juan from `#+PROPERTY: JUAN` or filename.
- `sourceDesc`: source is Kanripo; edition (WYG, HFL, …); GitHub URL; clone date.
- `revisionDesc/change`: import date, plugin id/version, normalisation table (or none), punctuation mode.

Do not put this in `sourceDesc` in a way that fights `biblStruct` if the project already uses that pattern — follow the XML-import provenance convention (`revisionDesc/change`).

### Commentary

`normalization_zh` `extract_commentary_from_text`: `(…)` spans, including continuation across a standalone `<pb>` line; fail the file on unbalanced parentheses.

Output: `<note type="comm">` inline at the same character position. Commentator-attribution parentheses that contain `/` (e.g. `嚴東…註/宋…集註`) are the same element type for v1 (already `type="comm"` in `dz_krp`).

Gaiji `[…]` must not be parsed as commentary delimiters (existing protect-parens-inside-brackets logic).

### Character normalisation

Apply **after** header parse, **before** alignment, to body text only (not to attribute values on `<pb/>`). Both sides of a parallel alignment must use the **same** table or the coverage bar will look like Swiss cheese.

Bundle both CSVs with the plugin so the choice does not depend on sibling repos at runtime.

---

## Punctuation option 1 — as-is

Pilcrow join + `<pb/>` + notes. No parallel, no AI. Default and always available.

---

## Punctuation option 2 — parallel transcription

### Sources (same IR)

Each source becomes punctuated plain text: characters + paragraph breaks + Chinese punctuation. Formats:

| Input | How |
| --- | --- |
| File | Reuse document-import extractors (txt, md, rtf, docx, odt, xml). Keep punctuation and paragraph breaks; strip chrome. |
| Paste | Same stripping on clipboard. |
| URL | Main-process fetch. Generic HTML → visible text. **zh.wikisource.org** (and siblings): MediaWiki parse API preferred. Best-effort for arbitrary sites (bots, login walls). |

Multiple sources per work/juan. Each may cover a different stretch.

### Alignment

The Kanripo juan is the **tape**. The parallel is often a **shorter sticker** (one Wikisource page), sometimes a **longer roll** (whole-book paste).

1. Build comparison strings (Chinese characters only; same normalisation).
2. If parallel is shorter: **infix** search (parallel inside juan) — e.g. edlib HW / local alignment. Existing `dz_krp` helpers assume the opposite (slice a long DZ book to one juan).
3. If parallel is longer: find the juan inside the parallel (current `dz_krp` `_find_dz_line_range_for_krp` idea).
4. Similarity threshold: below it → no overlap (empty bar), do not sprinkle random commas.
5. Transfer punctuation and `\n\n` paragraph breaks **only** onto the matching range. Treat `<pb/>` and `<note type="comm">` as single tokens (`align_punct.py`).

Unmatched prefix, suffix, and holes stay as option-1 lines.

Code to port (not call as a black box that emits old XML): `dz_krp/lib/align_punct.py`, `align_seq.py`; paragraph repair / dedupe passes in `convertor.py`.

### Coverage bar (“disk usage”)

One **horizontal bar per juan**; left = start of that Kanripo file, right = end. Scale = comparison-text character count (so `<pb/>` does not distort length).

| Colour | Meaning |
| --- | --- |
| Grey | No overlap; still unpunctuated lines |
| Green | Aligned; punctuation/paragraphs applied or previewed |
| Amber (optional) | Weak match — apply only if the user confirms |
| Second hue / hatch | Another source, or two sources overlapping |

Typical Wikisource picture: grey — green block — grey.

Behaviour:

- Adding a source **fills more of the bar** (disk filling up).
- Hover a green span → short Kanripo vs source preview + which source.
- Click → scroll the text preview to that passage.
- Caption: `covered 12,400 / 18,200 characters (68%)`.
- Whole work: **stack of bars** (one per juan).

Preview **before** Apply. After Apply, stamp punctuated stretches so the editor can redraw the bar later, e.g. `ana="ljb:parallel-punct"` on those `<p>`s (or a wrapping `div`), and list source URLs/paths in `revisionDesc` / `sourceDesc`.

AI can use the same bar as a second layer (e.g. blue = AI-proposed).

Fail closed: commentary vs base-text mismatch → empty bar, not speckles.

---

## Punctuation option 3 — AI (JSON, leave the text alone)

Same contract as auto-tagging structured output:

- Model must **not** rewrite characters.
- Returns JSON (offsets or “insert `。` after this n-gram”).
- Host inserts into the original string; verify every insertion against live text (drop failures).
- Chunk by juan or by a few hundred characters.
- Reuse project `AiApiSettings` / OpenAI-compatible `chat/completions` + `response_format` JSON schema.

Grey on the coverage bar = still untreated; can fill remaining holes after parallel.

---

## Search index

Ship a compact table in the plugin: `KR_ID`, title, optional author, dynasty. Source: `chinese_corpus_metadata/tables_output/krp_works.csv` (~9k GitHub works). GitHub org search is slower and incomplete (site catalogue vs GitHub disagree; see that repo’s Kanripo analysis).

Match: exact/prefix on `KR…`; substring (and later light fuzzy) on title.

Clone URL: `https://github.com/kanripo/<KR_ID>`. Some catalogued ids have no GitHub repo — surface a clear error.

---

## Output layout

```
<project>/imported/kanripo/KR1a0145/KR1a0145_001.xml
<project>/imported/kanripo/KR1a0145/KR1a0145_002.xml
…
```

Filename from the Kanripo stem. Existing-path suffixing as in document import. Do not auto-open every file for large works.

---

## UI sketch (wizard)

One large dialog, not a separate window per step:

```
┌ Import from Kanripo ─────────────────────────────────────┐
│ Search [ KR1a0145 / 周易函書…          ]                 │
│  KR1a0145  周易函書約存  胡煦  清                         │
│  …                                                       │
│ ─────────────────────────────────────────────────────────│
│ Normalise  ( ) off  (•) hard replacements  ( ) DPM table │
│ Punctuation  (•) as-is  ( ) parallel  ( ) AI             │
│                                                          │
│ [parallel panel, if selected]                            │
│   Sources: [+ File] [+ Paste] [+ URL]                    │
│   Juan 002  ████░░░░░░░░  22%  wikisource.org/…          │
│   Juan 003  ░░░░░░░░░░░░   0%                            │
│                                                          │
│                    [ Cancel ]  [ Import ]                │
└──────────────────────────────────────────────────────────┘
```

Editor command: same parallel/AI panel without search/clone.

---

## Reuse map

| Piece | Location | Role |
| --- | --- | --- |
| TEI skeleton + metadata merge | `schemaTemplates.ts`, `metadataApplyOverrides.ts`, document import provenance | Wrapper |
| Blind import extractors | `documentImport.ts` | Parallel file/paste → text |
| Page-break joining | `pageBreakDetection.ts`; Mandoku pilcrow rules in import-planning | `<pb/>` inside `<p>` |
| Plugin hybrid + Python IPC | `plugin-cjk-dates`, `pluginPythonBridge.ts` | Pattern |
| Work catalogue | `chinese_corpus_metadata` `krp_works.csv` | Search |
| Mandoku parse, pb, commentary split | `normalization_zh` (`kanripo_segment.py`, `commentary_extraction.py`); `dz_krp` `krp_metadata.py` | Body |
| Parallel punctuate/segment | `dz_krp` `align_punct.py`, `align_seq.py`, `convertor.py` | Option 2 (port; emit TEI not old XML) |
| Normalisation tables | `normalization_compile_table` `hard_replacements.csv`; `dz_krp` `dpm_variant_normalisation_table.csv` | Option radio |
| AI JSON | `llmClient.ts`, auto-tagging response contract | Option 3 |
| Wikisource fetch | corpus-extraction-planning (MediaWiki API) | URL source |

Do **not** ship `dz_krp` `build_document_xml` as the output document.

---

## Phasing

### Phase 0 — Host hooks

- Manifest `fileMenu` (or equivalent) + rebuild application menu.
- Git clone IPC + cache dir + delete-on-success.
- Python IPC timeout/progress without Sanmiao assumption.
- Empty plugin package: enable → menu item → stub dialog.

**Acceptance:** With plugin off, no menu item. With plugin on, File menu shows Import from Kanripo; dialog opens.

### Phase 1 — Search, clone, as-is TEI

- Bundled work index; search by id or title.
- Clone `kanripo/<KR_ID>`; convert each `.txt` to TEI (header, `<pb/>`, pilcrow join, `<note type="comm">`); write per juan; flush clone.
- Normalisation radio (including off).

**Acceptance:** Import `KR1a0145` (or a small KR id). Output XML validates against the project schema. `KR1a0145_002` has `<pb n="…"/>` inside paragraphs, joined lines where pilcrows are missing, Kanripo recorded in the header. Clone directory gone after success. Unbalanced `()` on a fixture file → that juan in the report, others still written.

### Phase 2 — Parallel punctuation + coverage bar

- File / paste sources; infix+superset alignment; punctuate overlap only.
- Coverage bar preview; `ana` (or equivalent) on applied spans.
- Editor command **Segment and punctuate…** with the same panel.

**Acceptance:** Paste a punctuated excerpt that matches the middle of a juan → green block in the middle, grey ends; Apply leaves ends as lines. Wrong text → empty bar, no punctuation. Editor command on an already-imported file redraws the bar from stamped spans.

### Phase 3 — URL / Wikisource

- Main-process fetch; generic HTML-to-text.
- Wikisource: MediaWiki parse API; add as a named source on the bar.

**Acceptance:** Point at a zh.wikisource page that overlaps one juan; that juan’s bar turns partly green; other juans stay grey.

### Phase 4 — AI JSON punctuation

- Same coverage bar (second colour); insertions verified; holes after parallel can be filled.

**Acceptance:** As-is juan + AI → punctuation inserted without character substitutions (diff of CJK letters empty). Invalid JSON / failed anchors dropped, counted in the report.

### Deferred

- Auto-lookup of CBETA/DZ/zhsj parallels from `normalization_compile_table` discovery (user still *can* attach those files by hand in Phase 2).
- Full Wikisource→TEI adapter (corpus-extraction E3); punctuation only needs text.
- Merging several juans into one XML.
- Keeping clones for offline re-import.
- Distinct `note/@type` for commentator-attribution vs interlinear.
- Profiled Mandoku rules in the generic import engine ([import-planning](import-planning.md) Phase 2) — this plugin can stay a specialised path even if that lands.

---

## Test fixtures

Keep samples out of git if they are large; small fixtures in the plugin or `docs/`-adjacent private corpus:

1. **`KR1a0145_002.txt`** (or a trimmed copy) — Mandoku header, `<pb:…>`, pilcrows, continuation across page break. Phase 1 gold.
2. A short file with `(interlinear)` spanning a `<pb>` line — note wrapping.
3. Unbalanced `(` — must fail that file.
4. Punctuated excerpt that matches only the middle of (2) — coverage bar + partial apply.
5. Unrelated punctuated paste — empty bar.

---

## Open questions (non-blocking)

1. Plugin id: `kanripo-import` vs `kanripo`.
2. Exact `ana` token vs wrapping `div` for punctuated spans (must be schema-legal for teiLite / teiAll / Simple Print).
3. Whether `*_000.txt` prefaces import in v1 (Kanripo often uses `_000` for front matter).
4. Shallow clone vs full history (shallow is enough to convert; flush anyway).
5. Generic URL fetch: user-agent, timeout, size cap, to avoid hanging the wizard.

---

## Suggested first implementation slice

Host File-menu contribution + stub plugin, then Phase 1 as-is TEI for one small KR id, with clone flush. Parallel/AI and the coverage bar wait until that path is stable.
