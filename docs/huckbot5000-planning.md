# Huckbot5000: can Hucker's translations be reduced to an algorithm?

**Status (2026-08-06):** Feasibility study complete. OCR extraction cleaned (step 1 of the
recommendation below). Repo/architecture decided. **Not yet built.** This doc records what the
experiments actually showed, including two results that argue against the original plan, plus
a live finding (CBDB) that's a bigger and more urgent issue than Huckbot5000 itself.
Feeds Phase 4 of [entity-display-translations-planning.md](entity-display-translations-planning.md)
— Phase 3 (the `roleName` = string+translation+date-range schema Huckbot5000's output must match)
is resolved in that doc but not yet built either; Phase 4 depends on it.

**Resume here.** See [Next up](#next-up) at the bottom for the current punch list.

## The question

We can't ship Hucker's *Dictionary of Official Titles* (copyrighted; see decision 3 in the
entity-display doc). The hoped-for way around it: if his translation practice can be reduced
to an algorithm, we ship the *algorithm* and its output, never his text. Two birds — legal
exposure drops, and gap-filling for offices Hucker never covered becomes a build step
rather than manual curation.

## Source data

`~/Code/leJeanBaptiste/authority extraction/skunkworks/scripts/out/hucker_entries.ndjson` —
9,619 OCR-extracted entries, fields `chinese / dynasty / translation_title / translation_full`.

After filtering to CJK headwords with a real title (dropping `variant of`, `abbreviation of`,
`lit.`, cross-references, etc.): **5,915 usable pairs, 5,424 unique headwords.**

### Data-quality: cleaned (2026-08-06)

Original known problems, root-caused and fixed in `skunkworks/scripts/parse_entries.py` —
**Stage 2 (parsing) only, Stage 1 (PDF→text extraction) untouched**:

- **Dynasty OCR truncation** — 207 `AN`, 65 `ING`, 35 `ANG`, 35 `NG` (mangled T'ANG / CH'ING /
  YÜAN / MING). Root cause: the source PDF's small-caps styling makes OCR misread the
  apostrophe in `T'ANG`/`CH'ING`, or the umlaut in `YÜAN`, as stray punctuation or a wrongly-cased
  accented letter — that breaks `TAG_RE`'s all-caps-run match, which backtracks and captures only
  the tail (`T,ANG:` → `ANG`; `YŭAN:` → `AN`). Fixed with `fix_dynasty_ocr_glyphs()`: four regexes
  anchored to each dynasty's exact consonant skeleton (`\bT..NG\b` etc.), matching any single
  non-ASCII glyph in the vowel slot rather than enumerating every diacritic. **342 → 14 rows**
  (96% reduction); `YUAN` count corrected from 284 to 434 (previously hiding in the `AN` bucket).
- **Row misalignment** (`translation_title` holding a bare dynasty string instead of a real
  translation, e.g. `司天監` → `T'ANG`) — root cause: when a definition spans multiple
  non-contiguous dynasties (`CHOU, N-S DIV (Chou):`), the old `TAG_RE` only matched the *last*
  item in the comma-joined list; earlier dynasty names were left as unparsed leftover text in
  `general_gloss`, which `extract_title()` then mistook for the actual title. Fixed by widening
  `TAG_RE` to capture the whole comma-joined list as one tag (also more correct: the dynasty
  scope is no longer silently dropped). **16 → 3 rows** (81% reduction).

Still open, not regex-fixable:
- **3,222 rows have no parsed `translation_title`** (was 3,197 pre-fix; the two bugs above didn't
  touch this population). This isn't a bug — Hucker's prose for these entries doesn't start with
  a short title-case phrase — so it's a real coverage ceiling on the `translation_title` field,
  not something to chase further with regex.
- **Headword-level OCR corruption** (`广如容漢軍堂`, `炻`, `提辩` for what should be 提點) —
  pure-CJK strings that are simply the *wrong* hanzi (visually-similar glyph misread), which no
  regex can tell apart from a genuine word. `extract_lines.py`'s existing `MANUAL_CORRECTIONS`
  block already holds itself to the right standard here (only fix what's cross-verified against
  another correctly-OCR'd occurrence of the same character elsewhere in the book) — 15 rows with
  no headword at all, plus an unknown number of wrong-but-plausible-looking ones, are flagged for
  that same manual, cross-checked process rather than guessed at automatically.

Everything downstream (lexicon, benchmark) should be re-run against the cleaned extraction before
any numbers from this doc are treated as final — the Experiment 1–3 numbers above predate this fix.

## Experiment 1 — is the lexicon regular? **Yes, strongly.**

Of 5,424 unique Chinese headwords, only **352 (6.5%) have more than one distinct English
rendering.** Hucker is 93.5% one-to-one. The period-dependence assumed in the entity-display
doc is real but far rarer at whole-title level than the design anticipated.

Mining character n-grams (1–4) against content words in the translations, with
p(gloss | morpheme) and lift over corpus base rate:

| morpheme | gloss | p | lift |
|---|---|---|---|
| 博士 | Erudite | 0.89 | ×137 |
| 鹽 | Salt | 0.90 | ×135 |
| 左 / 右 | Left / Right | 0.80 / 0.72 | ×102 / ×94 |
| 御史 | Censor | 0.68 | ×114 |
| 大夫 | Grand Master | 0.97 | ×33 |
| 提擧 | Supervisorate | 0.55 | ×113 |
| 局 | Service | 0.80 | ×27 |
| 郡 | Commandery | 0.89 | — |

**617 morphemes** clear support ≥5 / p ≥ 0.30 / lift ≥ 8 (271 at p ≥ 0.6), covering **92% of
held-out titles**. Emitted as `hucker_morpheme_lexicon.json` (scratchpad; not yet in-repo).

This part of the hypothesis holds. The lexicon is real, compact, and extractable.

## Experiment 2 — is it *generatively* compositional? **No.**

Built the full pipeline: IBM-Model-1 EM alignment → DP segmentation over the phrase table →
head-final reordering with "of"-insertion. Trained on 85%, tested on the held-out 15% (n=819).

| metric | result |
|---|---|
| exact content-word match | **4.8%** |
| correct head noun | 20.0% |
| mean content-word F1 | 0.314 |

Nearest-neighbour analogy (retrieve the most character-similar Hucker entry, reuse its
translation) does no better: F1 0.219, only 23% of items get a usable analogy.

Three distinct failure modes, all structural rather than fixable by more data:

1. **Segmentation ambiguity.** 司天監 is 司天(astronomy) + 監, not 司 + 天 + 監. The generator
   produced "Directorate of Office Astronomy" against gold "Directorate of Astronomy".
2. **Bound ≠ free forms.** 尚書 standing alone is "Minister"; inside 尚書省 the same characters
   are "Department of State Affairs". A headword lexicon cannot express this.
3. **Head-marking is soft, not rule-governed.** Whether Hucker writes "Directorate of X" or
   "X Directorate" correlates with the final character only probabilistically — 寺 takes *of*
   74% of the time, 案 9%, 官 16%. Eight English templates are in play and none dominates
   (Modifier+Head 33%, HEAD of X 26%, bare head 10%).

## Experiment 3 — does retrieval-augmented LLM composition help? **No measurable lift.**

No API key in this environment, so the composition model was Claude itself, in-context.
Two **disjoint** 50-item arms from the same held-out split (disjoint to avoid carry-over
priming), lexicon built from train only:

- **Arm A (control):** bare Chinese title + dynasty, no retrieval.
- **Arm B (treatment):** + mined morpheme lexicon + 6 nearest Hucker exemplars.

| arm | exact | head noun | F1 |
|---|---|---|---|
| rule-based baseline (n=819) | 4.8% | 20.0% | 0.314 |
| **A — no retrieval** (n=50) | **28.0%** | 50.0% | 0.541 |
| **B — +lexicon +exemplars** (n=50) | **28.0%** | 46.0% | 0.484 |

Exact-match 95% Wilson CI for both arms: 17–42%. The arms are statistically indistinguishable,
and B is *slightly worse* on F1 and head noun.

Hand-rating every non-exact output for scholarly adequacy (would a sinologist accept this
gloss, even though it isn't Hucker's wording?), excluding items where gold is OCR-corrupt:

| arm | exact | +adequate | = usable | partial | wrong |
|---|---|---|---|---|---|
| A | 14 | 24 | **38/48 (79%)** | 4 | 6 |
| B | 14 | 20 | **34/48 (71%)** | 9 | 5 |

### Why retrieval failed

Retrieval actively misled on several items. The clearest case is 內大 [CH'ING]: the retrieved
exemplar set contained *the identical headword* glossed "Grand Minister of the Imperial
Household Department", which I copied — gold for this entry is "Grand Minister Assistant
Commander of the Imperial Guard". That is the 6.5% polysemy from Experiment 1, and retrieval
walks straight into it with full confidence. Similarly 春官: exemplar said "Spring Office",
gold for T'ANG is "Ministry of Rites".

Noisy exemplars are worse than no exemplars when the corpus itself is inconsistent and OCR-dirty.

## The result that matters most: pretraining contamination

**Arm A had no retrieval at all and still reproduced 28% of Hucker's translations exactly.**
Including distinctively Huckerian renderings — 郞中令 → "Chamberlain for Attendants" is his
signature construction, not a phrase derivable from the characters.

This is not a good sign for the legal framing. The plan assumed Huckbot5000 output would be
*synthesized* and therefore clean. But Hucker's dictionary is foundational in sinology and is
plainly in the training data of any frontier model. An LLM asked to translate an office title
"as Hucker would" may be **recalling** his text, not deriving it. "We modelled his method" is a
substantially weaker claim when the model can reproduce the source cold.

This does not sink the project, but it changes what has to be true before shipping:
output must be **checked against** the extracted corpus and near-verbatim matches suppressed
or re-tagged — the opposite of the original design, where matching Hucker was the success metric.

### And exact-match is the wrong metric anyway

If the goal is *not* to ship Hucker, then "Wine Workshop" where Hucker wrote "Imperial Winery",
or "Provisioner" where he wrote "Almoner", is a **success**, not an error — a serviceable
scholarly gloss that is demonstrably not his text. The 79% adequacy number is the product-relevant
one; the 28% exact number is the *legal-risk* one. They should be optimized in opposite directions.

## Recommendation

Do not build the rule-based generator (4.8% — dead end). Do not build the retrieval-augmented
pipeline as specified in the entity-display doc either; the retrieval arm showed no lift and
introduced polysemy errors.

Proposed shape, in dependency order:

- ~~**Step 1 — Clean the extraction.**~~ **Done (2026-08-06).** See
  [Data-quality: cleaned](#data-quality-cleaned-2026-08-06) above. Two systematic Stage-2 parser
  bugs fixed and validated; residual issues (title coverage ceiling, headword OCR corruption)
  flagged for manual review, not auto-fixed.
- **Step 2 — Ship the morpheme lexicon, not the entries.** 617 morpheme→gloss pairs is a
  derived, compact, factual artifact — a far better position than the 9,619-entry extraction
  currently sitting in skunkworks. Useful on its own for romanization display and autocomplete
  even if no generation ever ships. **Should be re-mined against the cleaned extraction** before
  compiling (the 617-count above predates the OCR fix).
- **Step 3 — Re-run Experiment 3 against a real API** at n≈300 with an actual model rather than
  in-context self-play, on cleaned data. The n=50 CIs (17–42%) are too wide to decide anything.
  This is the go/no-go number.
- **Step 4 — Add a verbatim-collision filter** as a hard gate: any generated gloss whose content
  words match a Hucker entry for the same headword gets tagged `source: 'Hucker'` (local-only,
  never shipped), not `source: 'Huckbot5000'`. This inverts the current success metric and is
  the concrete mitigation for the contamination finding. **Must also check against CBDB's own
  `translation` field** (see [CBDB finding](#cbdb-finding-2026-08-06-bigger-and-more-urgent) below)
  — a generated gloss that collides with CBDB's Hucker-tagged field is exactly as much a
  collision as one that matches the raw Hucker corpus directly.
- **Step 5 — Period variants.** Only 6.5% of headwords are polysemous, so the
  `EntityDates`-ranged translation-variant model (decision 4 in the entity-display doc) is
  sound but low-yield. Worth doing after the above, not before. Note the "whose date?" question
  there is still unanswered and still blocks it.

## Repo & architecture (decided 2026-08-06)

**Lives in `authority extraction`** (git remote `authoritypacks`), not `leaf-writer` or
`plugins` directly — every other China-specific source (CBDB, DILA, Norbert, CHGIS) is a build
track in that repo, compiled to `packs/*`, published as GitHub release assets, consumed
downstream. Huckbot5000 is another track of the same kind, alongside `packs/norbert/`.

- **`skunkworks/` is already gitignored** — the raw OCR extraction and source PDF never need to
  move; they're already excluded from git in the repo where the build step needs to run.
- **`noble-titles/` is the pattern to copy.** Reviewed-boundary shape: audit script → decision
  table (`accepted`/`deferred`/`rejected`) → compile only accepted rows into
  `approved-include.ndjson` → build reads only that file, never the raw source. Huckbot5000
  should follow the same shape, with the verbatim-collision filter (Step 4) as an automatic
  `rejected` in that same table rather than a separate mechanism.
- **Consumer:** `plugin-norbert` in the `plugins` repo — already references `authoritypacks`
  releases, no new plugin needed.
- **Output schema** is fixed by `entity-display-translations-planning.md` Phase 3: a `roleName`
  entity is string + translation + date range, one entity per period-specific office, matching
  CBDB's own granularity — `packs/cbdb/offices.ndjson` already has this shape (`dynasty`,
  `startYear`, `endYear`, `authorityId`). Huckbot5000's output is a translation keyed to a
  specific `cbdb:office:<id>` / `norbert:office:<id>`, not a bare string.

### CBDB reference-tier-first (decided 2026-08-06)

Daniel's framing: **don't ship CBDB's office translations ourselves — have the user's own
install fetch CBDB, and read the translation from that at lookup time, with Huckbot5000 only
filling gaps CBDB doesn't cover.**

This fits architecture already in place, with one gap to close:

- `cbdb/stripReferenceDb.mjs` already keeps `OFFICE_CODES` and the posting tables in the
  person-reference sqlite (`cbdb-person.sqlite3`), built separately from the tagging-pack NDJSON
  by `build-reference-bundle.mjs` — office translations are already positioned as reference-tier
  data, not tagging-pack data, in the existing two-tier model
  ([authority-data-lifecycle.md](authority-data-lifecycle.md)).
- **Gap:** that reference zip is currently *also* mirrored through your own GitHub release
  (`build-reference-bundle.mjs` → GitHub), same as the tagging packs — so today it's still you
  redistributing CBDB's `translation` field, just via a different tier. To make "the user's
  computer downloads it, not us" true rather than nominal, the CBDB reference fetch needs to
  point at CBDB's own official public distribution instead of a GitHub mirror built from your own
  copy of the SQL dump — the same pattern already used for DILA reference data (Open Content
  mirror, not a GitHub copy). Not yet built; independent of the OCR cleanup above.
- **Lookup precedence**, once built: `authorityRef:lookup(source, id)` (the existing A6
  mechanism) already implements "prefer reference over pack" for names/nationality/appointments —
  office translations should be one more field on that same path. CBDB reference (user-downloaded)
  takes priority; Huckbot5000 pack (the one this project ships) fills only what CBDB has no
  translation for.

### CBDB finding — CONFIRMED (audit `task_7d697bb9` complete, 2026-08-06)

While locating the office-entity schema, found that `packs/cbdb/offices.ndjson` (33,767 office
entries, compiled from CBDB's own SQL dump) has a `translation` field, and **2,360–2,367 of
those entries end in the literal string "(Hucker)"**. Audit result: **this is
verbatim/near-verbatim copying, and the currently-shipped pack needs remediation.**

- **Source confirmed:** [cbdb/compileRecords.mjs:377](../../authority%20extraction/cbdb/compileRecords.mjs:377)
  pipes CBDB's `OFFICE_CODES.c_office_trans` straight through, untransformed. The `(Hucker)`
  suffix is CBDB's own citation marker in their upstream data, not something our compile step adds.
- **Similarity, sampled (n=30, seeded):** 80% verbatim substring match against Hucker's full
  entry text; ~0.95 average Levenshtein similarity where a short title could be compared. This is
  CBDB lifting Hucker's gloss as its canonical English translation, not paraphrasing him.
- **No rights basis found:** CBDB's own sources documentation doesn't list Hucker or Stanford
  University Press as a licensed data source for `OFFICE_CODES`. CBDB's site-wide CC-BY-NC-SA-4.0
  claim covers CBDB's own compiled content — it cannot sublicense a third party's copyrighted
  prose just by tagging it with a citation.
- **Correction to earlier assumption in this doc:** Hucker's *A Dictionary of Official Titles in
  Imperial China* was published by **Stanford University Press (1985)**, not Michigan. Hucker
  died in 1994; under US copyright (life + 70) the work is protected through **2064** — not
  public domain, not close.
- **Already live:** GitHub release **v0.1.13** (current, consumed by leaf-writer) ships 2,360 of
  these strings under a manifest crediting only CBDB, CC-BY-NC-SA-4.0, no mention of Hucker.

**This is a pre-existing exposure, independent of whether Huckbot5000 ever ships**, and it's
already distributed, not just staged locally. Recommended remediation (from the audit, not yet
executed): strip `metadata.translation` / `alternateTranslation` / `description` for the
`(Hucker)`-tagged rows in `compileRecords.mjs` (CBDB's own Chinese/pinyin/dynasty/office-type
data is unaffected), then cut a follow-up release. This is a publish action on an already-public
artifact — tracked as its own to-do item below, not executed inline. Blocks Step 4's matcher
either way (need to know what "the untranslated remainder" excludes once this field is gone).

## Legal note (not advice)

Daniel is at Collège de France, so the EU *sui generis* database right (Directive 96/9/EC)
applies and has no US equivalent. It protects substantial extraction from a database
independently of whether the individual contents are copyrightable — a different question from
the copyright analysis in the entity-display doc, which is the one that's been reasoned about
so far. A 617-entry derived morpheme lexicon is a materially better position than the full
9,619-entry extraction. Worth a real opinion before anything ships publicly.

CBDB's terms restricting redistribution of their Hucker-derived field: **confirmed, not just
flagged** — see [CBDB finding](#cbdb-finding--confirmed-audit-task_7d697bb9-complete-2026-08-06)
above. Audit complete.

## Reproducing

Fix location: `authority extraction/skunkworks/scripts/parse_entries.py`
(`fix_dynasty_ocr_glyphs`, widened `TAG_RE`) — run `python3 parse_entries.py` from
`skunkworks/scripts/` to regenerate `out/hucker_entries.ndjson` against the current PDF
extraction (`extract_lines.py` output, unchanged).

Analysis scripts in the session scratchpad (`mine.py`, `compose.py`, `structure.py`, `gen.py`,
`harness.py`, `score.py`, `lexicon.py`) — throwaway, not productionized, and **all predate the
OCR fix above** (re-run against the regenerated `hucker_entries.ndjson` before trusting their
numbers again). If Step 3 proceeds, `harness.py` (train-only lexicon build, disjoint-arm prompt
generation) and `score.py` (exact / head / F1 + Wilson CI) are the two worth keeping.

## Next up

Resumable punch list.

**Tracked, deliberately not done this version (2026-08-06):** cut one combined `authoritypacks`
release superseding v0.1.13 that both (a) ships the Hucker-stripped `offices.ndjson` (item 1)
and (b) supersedes/yanks the three live `authority-reference-person-*.zip` assets on
v0.1.13/v0.1.12/v0.1.10 that still carry the old unfiltered `cbdb-person.sqlite3` (0 downloads
so far). Daniel: "we're not done with this version yet" — do this as one release when ready, not
piecemeal, and not automatically (publish action on shared state).

1. ~~Wait on `task_7d697bb9`~~ / ~~Remediate the CBDB office pack~~ **Code done (2026-08-06).**
   `cbdb/compileRecords.mjs` now strips `translation`/`description` for any row whose upstream
   `c_office_trans` carries the `(Hucker)` citation (surgical — `alternateTranslation` never had
   the tag, and 18,452 of 20,819 non-Hucker translations are untouched). Re-ran `compile:cbdb`;
   verified `(Hucker)` count in `packs/cbdb/offices.ndjson` is 0, translation-field count dropped
   by exactly 2,367. **Still open: cutting the follow-up `authoritypacks` release superseding
   v0.1.13** — that's a publish action on an already-public artifact, needs Daniel's go-ahead,
   not done yet. Minor unrelated side-effect noted: `cbdbOfficeClue` (`shared/clue.mjs`, pre-existing)
   emits a dangling paren when translation is absent but dynasty is present, now visible on
   ~2,367 more rows — flagged, not fixed.
2. ~~Remove CBDB from our repo for office translations; fetch reference data from Harvard
   directly~~ **Done (2026-08-06).** Turned out build-time sourcing was already clean
   (`fetch-upstream.mjs` already pulls CBDB's official HuggingFace release, sha256-pinned) — the
   actual gap was `build-reference-bundle.mjs` repackaging that into our own GitHub release.
   Fixed in `leaf-writer`: new `downloadCbdbDirect()` in `apps/desktop/src/authorityDatabases.ts`
   fetches CBDB's official release directly (same HuggingFace URL/pin) and strips it locally via
   the bundled `authority extraction` CLI (`cbdb/stripReferenceDb.mjs` — reused as-is, the exact
   script the build pipeline itself runs, not a reimplementation) using the existing
   `resolveAuthorityExtractionRoot`/`runNodeScript` pattern already used for on-device compiling.
   Split out into a new `nodeScriptRunner.ts` module to avoid a circular import with
   `authorityCompile.ts`. Norbert still downloads via the old reference-zip path
   (`downloadNorbertReferenceBundle`, renamed but otherwise unchanged — no redistribution concern
   there, it's our own reduced-authority export, not third-party copyrighted content); CBDB and
   Norbert are no longer treated as one shared download group in `authorityLifecycle.ts`.
   Decision made 2026-08-06: user chose "strip locally in LJB" over "keep the full 550MB file" —
   full official CBDB sqlite is 550MB vs. the 231MB stripped result; each install downloads the
   full file once, strips it, discards the original. Typecheck clean, existing test suites
   (`authorityDatabases.test.ts`, `authorityLifecycle.test.ts`, 11 tests) pass unmodified.
   **Follow-up now also done (2026-08-06):** `build-reference-bundle.mjs` no longer builds or
   bundles `cbdb-person.sqlite3` at all — rewritten to ship Norbert only, renamed
   `authority-reference-norbert-{version}.zip`. `cbdb/stripReferenceDb.mjs` (the script both this
   pipeline and LJB's `downloadCbdbDirect` call) now also strips `(Hucker)`-tagged
   `OFFICE_CODES.c_office_trans` rows itself — defense in depth, verified against the real
   550MB CBDB sqlite (20,127 legitimate translations kept, 0 `(Hucker)` remaining). Deleted two
   stale local artifacts that predated all of this (`dist/reference/cbdb-person.sqlite3`,
   `release/authority-reference-person-*.zip`) — both gitignored, never committed, but contained
   the old unfiltered data.
   **Still open, needs a decision:** the *live* GitHub release assets
   `authority-reference-person-20260627+2026-07-25-reduced-authority.zip` on **v0.1.13, v0.1.12,
   and v0.1.10** still contain the old unfiltered `cbdb-person.sqlite3` (built before today's
   fix). **0 downloads on all three** as of 2026-08-06, so nothing has actually gone out yet, but
   they're publicly downloadable right now. This is a publish/destructive action on shared state
   (yanking or superseding a release asset) — bundle with item 1's pending release cut rather
   than act on it separately.
3. ~~Re-mine the morpheme lexicon against the cleaned extraction~~ **Done (2026-08-06).**
   `authority extraction/huckbot5000/compile.mjs` (new, matches the `compile:norbert`/`compile:cbdb`
   convention) → `npm run compile:huckbot5000` → 615 morphemes (272 high-confidence) from 5,894
   source pairs, written to `packs/huckbot5000/lexicon.ndjson` + manifest (gitignored, matching
   other compiled packs; `license: 'internal-pending-review'` — not marked shippable, see Legal note).
4. ~~Re-run Experiment 3 at n≈300 against a real API~~ **Done (2026-08-06) — negative result,
   confirms the composition step isn't ready.** Ran n=300 (150/arm) against **Ministral 8B
   (`ministral-3:latest`) via local Ollama**, same disjoint-arm design as the self-play study.
   Script: `ollama_harness.py` (scratchpad) — real HTTP calls to `localhost:11434/api/generate`,
   ~9s/call, ~35 min total.

   | arm | n | exact | head noun | F1 |
   |---|---|---|---|---|
   | A: no retrieval | 150 | 0.7% (CI 0.1–3.7%) | 12.7% | 0.147 |
   | B: +lexicon+exemplars | 150 | 2.7% (CI 1.0–6.7%) | 20.7% | 0.237 |
   | *cf. Claude self-play A/B (n=50)* | | *28.0% / 28.0%* | *50.0% / 46.0%* | *0.541 / 0.484* |
   | *cf. rule-based lexicon lookup (n=819)* | | *4.8%* | *20.0%* | *0.314* |

   **Ministral doesn't clear the naive rule-based bar even with retrieval.** Two findings worth
   keeping: (1) **retrieval helps Ministral a lot** (exact match ~4×, head noun ~1.6×) — the
   opposite of Claude, where it gave zero lift — a smaller model leans on structured context
   more because it has less to draw on unprompted. (2) Hand-rated adequacy on a 25-item spread:
   ~44–48% adequate, ~28% partial, ~28% wrong — well below Claude's 79%, with a diagnostic
   failure mode of **false-cognate errors on obscure classical vocabulary** (黨 "ward" →
   "Party Chief"; 水衡 a Han fiscal office → "Waterworks"). Not a scoring artifact — checked
   for truncation/markdown-parsing issues first (none found; asterisks don't affect
   word-tokenized scoring).

   **Conclusion at the time:** don't ship Ministral-generated translations unsupervised. See
   below — the follow-up GPT-4o test changes some of what this implied about Claude's numbers,
   not the Ministral numbers themselves.

   **Follow-up (2026-08-06, same day): real GPT-4o test, n=300, via Daniel's own OpenAI API
   credits.** Script: `openai_harness.py` (scratchpad), same disjoint-arm design, real HTTP calls
   to the Chat Completions API, ~1/s, ~5 min total, cost a few cents.

   | arm | n | exact | 95% CI | head noun | F1 |
   |---|---|---|---|---|---|
   | A: no retrieval | 150 | **6.0%** | 3.2–11.0% | 16.7% | 0.237 |
   | B: +lexicon+exemplars | 150 | **14.0%** | 9.3–20.5% | 30.7% | 0.386 |
   | *cf. Claude self-play A/B (n=50)* | | *28.0% / 28.0%* | *50.0% / 46.0%* | *0.541 / 0.484* |
   | *cf. Ministral 8B A/B (n=300)* | | *0.7% / 2.7%* | | *12.7% / 20.7%* | *0.147 / 0.237* |
   | *cf. rule-based lexicon lookup (n=819)* | | *4.8%* | | *20.0%* | *0.314* |

   Two things this changes:

   1. **The Claude self-play numbers (28%) are almost certainly inflated** — real, independently
      run exact match for a comparable frontier model (GPT-4o) is 6.0% with no retrieval. This
      isn't a self-grading artifact (exact/F1/head are mechanical string comparisons, not
      subjective ratings) — more likely, generating *inside a conversation where the model knows
      exactly what's being tested* behaves differently than a cold, stateless API call. **Treat
      the self-play numbers as unreliable going forward; this GPT-4o result is the better
      reference point.**
   2. **Retrieval genuinely helps real models — the self-play "zero lift" finding doesn't
      replicate.** GPT-4o with retrieval more than doubled exact match (6.0%→14.0%) and lifted F1
      63% (0.237→0.386). Combined with Ministral (where retrieval also helped, ~4×), that's two
      independent real tests agreeing against the one self-play test. Retrieval-augmented
      generation should be the default going forward, not something to reconsider dropping.

   **GPT-4o + retrieval is the first approach tested that actually clears the rule-based floor**
   for real (14.0%/0.386 vs. 4.8%/0.314) — modest, but genuine, and the misses mostly read as
   reasonable paraphrases rather than garbage (職方氏 gold "Overseer of Feudatories" → "Regional
   Operations Official"; 詳斷案 gold "Sentence Evaluators Section" → "Case Evaluator").

   **One contamination flag beyond lexical exact-match:** 脫脫禾孫 came back as *"Meaning and
   derivation not clear"* — not a translation, but Hucker's own stock hedge phrase for
   etymologically obscure entries (encountered repeatedly while cleaning the OCR extraction
   earlier in this doc). Word-overlap scoring doesn't flag this as a hit since it doesn't match
   the gold gloss, but it's evidence the model can recall Hucker's *editorial voice*, not just
   vocabulary. **The verbatim-collision filter (Step 4) needs to catch stylistic tells like this,
   not just check the final phrase against Hucker's headword gloss.**

   **Revised conclusion:** GPT-4o+retrieval is more promising than any approach tested so far —
   worth pursuing the collision-filter-plus-human-review path over the Ministral-drafter idea.
   6% baseline contamination (no retrieval) is real but lower than the self-play estimate
   suggested, and the filter is buildable; it just needs to check for stylistic patterns
   (hedging phrases, characteristic Hucker constructions) in addition to headword-gloss matches.
5. **leaf-writer Phase 3** (candidate-picker date-range UI, in `entity-display-translations-planning.md`)
   — not started; Phase 4 (this project) can't ship usable output without it, though the pipeline
   itself can be built in parallel.
6. **Collision-filter + human-review pipeline — built (2026-08-06).** Five scripts in
   `authority extraction/huckbot5000/`, mirroring the `noble-titles/` reviewed-boundary pattern:
   `generate.mjs` (GPT-4o + retrieval, production port of `openai_harness.py`, targets CBDB's
   12,704 untranslated office headwords by default, `--sample`/`--limit`/`--dry-run`/`--resume`),
   `audit.mjs` (collision filter → `reports/huckbot5000-candidate-review.csv`),
   `scripts/compile-huckbot5000-include.mjs` (reviewed CSV → `approved-include.ndjson`, hard-gates
   on `collisionFlag` even if a reviewer marks a row accepted), `compileTranslations.mjs`
   (approved-include → shippable `packs/huckbot5000/translations.ndjson`, tagged
   `source: 'Huckbot5000'`). Collision logic (`lib.mjs`'s `detectCollision`) checks exact match,
   ≥85% string similarity, full and subset content-word overlap, and Hucker's own stock hedge
   phrases ("meaning and derivation not clear" etc.) — 13 passing unit tests. Full pipeline
   dry-run tested end-to-end on synthetic data; full repo test suite (221 tests) green. **Not yet
   run against live CBDB targets** — needs a scoping decision (pilot sample vs. full run) before
   spending real API credits on ~12.7k headwords (~3.5hrs at ~1/s). Not committed to git yet.
   Full detail in [[project_huckbot5000_feasibility]].

Remaining open items: the release cut in item 1, item 5, and scoping/running item 6's
first real generation pass.
