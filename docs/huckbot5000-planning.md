# Huckbot5000: can Hucker's translations be reduced to an algorithm?

**Status (2026-08-06):** Feasibility study complete, **not built**. This doc records what the
experiments actually showed, including two results that argue against the original plan.
Feeds Phase 3 of [entity-display-translations-planning.md](entity-display-translations-planning.md)
(period-filtered office glosses) — the one phase there still open.

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

Known data-quality problems, unfixed:
- `dynasty` has OCR truncation — 207 `AN`, 65 `ING`, 35 `ANG`, 35 `NG` (mangled T'ANG / CH'ING).
- 3,197 entries parse no `translation_title` at all.
- Headword-level OCR corruption survives into the corpus (`广如容漢軍堂`, `炻`, `提辩` for 提點).
- Some `translation_title` fields contain a dynasty string instead of a translation
  (`司天監` → `T'ANG`, `法物案` → `SUNG`), i.e. row misalignment in the parser.

Anything downstream inherits these. Cleaning is a prerequisite, not an optimization.

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

Proposed shape instead, in dependency order:

- **Step 1 — Clean the extraction.** Fix the parser row-misalignment, repair truncated dynasty
  strings, drop or flag OCR-corrupt headwords. Everything else is blocked on this and current
  numbers are all depressed by it.
- **Step 2 — Ship the morpheme lexicon, not the entries.** 617 morpheme→gloss pairs is a
  derived, compact, factual artifact — a far better position than the 9,619-entry extraction
  currently sitting in skunkworks. Useful on its own for romanization display and autocomplete
  even if no generation ever ships.
- **Step 3 — Re-run Experiment 3 against a real API** at n≈300 with an actual model rather than
  in-context self-play, on cleaned data. The n=50 CIs (17–42%) are too wide to decide anything.
  This is the go/no-go number.
- **Step 4 — Add a verbatim-collision filter** as a hard gate: any generated gloss whose content
  words match a Hucker entry for the same headword gets tagged `source: 'Hucker'` (local-only,
  never shipped), not `source: 'Huckbot5000'`. This inverts the current success metric and is
  the concrete mitigation for the contamination finding.
- **Step 5 — Period variants.** Only 6.5% of headwords are polysemous, so the
  `EntityDates`-ranged translation-variant model (decision 4 in the entity-display doc) is
  sound but low-yield. Worth doing after the above, not before. Note the "whose date?" question
  there is still unanswered and still blocks it.

## Legal note (not advice)

Daniel is at Collège de France, so the EU *sui generis* database right (Directive 96/9/EC)
applies and has no US equivalent. It protects substantial extraction from a database
independently of whether the individual contents are copyrightable — a different question from
the copyright analysis in the entity-display doc, which is the one that's been reasoned about
so far. A 617-entry derived morpheme lexicon is a materially better position than the full
9,619-entry extraction. Worth a real opinion before anything ships publicly.

CBDB's terms may separately restrict redistributing their Hucker-derived fields — still
unchecked, still flagged in the entity-display doc.

## Reproducing

Scripts in the session scratchpad (`mine.py`, `compose.py`, `structure.py`, `gen.py`,
`harness.py`, `score.py`, `lexicon.py`). They are throwaway analysis, not productionized —
if Step 3 proceeds, `harness.py` (train-only lexicon build, disjoint-arm prompt generation)
and `score.py` (exact / head / F1 + Wilson CI) are the two worth keeping.
