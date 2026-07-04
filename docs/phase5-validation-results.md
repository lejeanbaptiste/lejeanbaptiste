# Phase 5 AI-suggest validation — methodology and first results

Companion to [Auto-tagging-phases.md](Auto-tagging-phases.md) → Phase 5. Records how the
precision/recall validation harness works and the first live measurement against a local
Ministral model, so the numbers don't get re-litigated from scratch next time.

## Why a harness, not eyeballing

Phase 5's "Prepare" list called for "a validation harness: run suggest on a manually-tagged
document and measure precision/recall before wiring the UI." `sizhu_shang.xml` is already
densely hand-tagged, which makes it usable as ground truth for free — no separate annotation
pass needed.

## How it works

Built at [`autoTagging/validationHarness.ts`](../packages/cwrc-leafwriter/src/autoTagging/validationHarness.ts).

1. **`goldMentions(doc, policy, tags)`** — every existing tagged mention of the given tags
   *is* a gold entity. Occurrence is numbered the same way `Anchor.occurrence` is (1-based,
   whole-document, counted over the flattened search text) — which is identical whether a
   mention is wrapped in a tag or not, since stripping a tag never changes the document's
   character content. That's what makes a gold mention directly comparable to a predicted
   suggestion's anchor with no extra bookkeeping.
2. **`stripTags(doc, tags)`** — clones the document and unwraps the given tags back to plain
   text: this is what `llmSuggest` actually receives in production.
3. **`llmSuggest`** runs on the stripped document as normal — same chunking, same two-layer
   validation (schema, then anchor verification), same cache.
4. **`scoreSuggestions(gold, predicted)`** — exact match on `(surface, occurrence)`:
   - both span and tag agree → **TP**
   - predicted span matches no gold mention at all → **FP** (spurious)
   - predicted span matches a gold mention but the tag differs → counted as **both** an FP
     (predicted tag) and an FN (gold tag), and also logged separately as a **wrong-tag
     finding** so a systematic confusion (e.g. title vs persName) is visible instead of
     buried in the aggregate
   - gold mention with no matching prediction → **FN** (missed)
5. Model output dropped by schema or anchor verification is reported as `unverifiableCount`
   and **excluded** from FP/FN — a hallucination the anchor check already caught isn't the
   same failure mode as a wrong confident guess, so it shouldn't be scored as one.

`runValidationHarness(doc, options)` wires all four steps together and returns a
`HarnessReport` (overall + per-tag `Metrics`, `wrongTag[]`, `unverifiableCount`, `goldCount`,
`predictedCount`).

11 unit tests cover the scoring math and the strip/gold-extraction logic against a fake
`LlmClient` (no network) — see `validationHarness.test.ts`.

## The important limitation: gold is incomplete

`sizhu_shang.xml`'s tags are DPM's own hand-tagging, done at whatever pace/coverage he'd
reached — **not** an exhaustive gold standard. A plain suggest run over the same text (no
scoring, just counting candidates) found 131 candidates; the harness run below found only
100 gold mentions to compare against. That gap means a real, correctly-identified entity that
simply hasn't been hand-tagged yet in this document will score as a **false positive** here,
deflating measured precision below the true value.

**Practical consequence:** precision as measured is a *floor*, not a trustworthy number, until
the gold document's own tagging is more complete (or a more densely/completely tagged
document is used instead). **Recall is more trustworthy** — a gold mention the model fails to
find is unambiguously a miss regardless of how complete the rest of the tagging is.

## First live run (2026-07-04)

Model: `mistralai/ministral-3-8b`, served locally via LM Studio (OpenAI-compatible endpoint,
reused through `MistralLlmClient` pointed at `localhost:1234`). Document: `sizhu_shang.xml`
(full text, ~24 KB), chunked at `targetChars: 800` / `marginChars: 100`. No persistent cache —
every chunk was a fresh model call. Runtime: **~38 minutes** for the whole document,
sequential chunk-by-chunk.

```
gold mentions:  100     predicted: 138     unverifiable: 28
overall:    P=0.355  R=0.490  F1=0.412  (tp=49 fp=89 fn=51)
persName:   P=0.358  R=0.630  F1=0.456  (tp=34 fp=61 fn=20)
placeName:  P=0.349  R=0.326  F1=0.337  (tp=15 fp=28 fn=31)
```

No wrong-tag confusions were found — every one of the 89 FPs was a span matching no gold
mention at all, not a mislabeled span. That rules out "the model confuses persName and
placeName" as the story; the remaining question is how many of those 89 are real entities
missing from gold versus genuine hallucinations (already anchor-verified as real text spans —
only the *entity claim* is what's unverified).

### Reading the numbers

- **Recall is the trustworthy half of this result, and it's mediocre**: the model missed 37%
  of already-known personal names and 67% of already-known place names. That gap holds
  regardless of gold completeness.
- **placeName underperforms persName** across the board (lower precision, much lower recall,
  lower F1). Worth checking by hand whether that's a genuine model weakness on the
  mythological/cosmological place names common in this text (玉京, 三十二天, 大浮黎, etc. — see
  the earlier suggest-only spot-check in session), or a prompt issue (the placeName
  description in `prompts.ts` may need tightening/examples).
- **Precision cannot be trusted yet** — see the gold-incompleteness caveat above.

## Gold-standard document (2026-07-04)

DPM prepared **`test_project/corpus_a/gold/gold_test.xml`**: a short, exhaustively hand-tagged
passage (後漢書·鄭玄列傳, four `<p>` blocks). Both `persName` and `placeName` use flat tags only
(no nested markup inside the gold tags). **65 gold mentions** extracted by the harness — this
is the first run where **both precision and recall are trustworthy**.

Live harness: `validationHarness.live.test.ts` (opt-in via `LLM_LIVE_TEST=1`). Same chunk
settings as the `sizhu_shang` run: `targetChars: 800` / `marginChars: 100`, `policy: ignore`.

### Groq — `qwen/qwen3-32b` (2026-07-04)

Hosted Groq API (`https://api.groq.com/openai`), `reasoning_effort: none`, prompt-only JSON
(no `json_schema` — Qwen3 on Groq rejects it; see [phase5-ai-integration-log.md](phase5-ai-integration-log.md)).
Runtime: **~1.5 s** (four chunks, sparse output).

```
gold mentions:  65     predicted: 8      unverifiable: 2
overall:    P=0.750  R=0.092  F1=0.164  (tp=6 fp=2 fn=59)
persName:   P=0.750  R=0.118  F1=0.203  (tp=6 fp=2 fn=45)
placeName:  P=1.000  R=0.000  F1=0.000  (tp=0 fp=0 fn=14)
wrong-tag:  0
```

**Read:** precision is decent when the model speaks (6/8 correct), but **recall is very low**
— only 8 suggestions for 65 gold mentions. **All 14 placeName mentions were missed** (zero
predictions). No wrong-tag confusions. The model appears to return empty or near-empty
`suggestions` arrays on most chunks under the Groq prompt-only path.

A second run on the same day (same settings, key auto-detected via `GROQ_API_KEY`) was
consistent: 7 predictions, P=.57 R=.06 F1=.11, 0/14 placeName — still too sparse.

### Groq — `qwen/qwen3.6-27b` (2026-07-04)

Same gold file, same chunk settings, Groq API, `reasoning_effort: none`, prompt-only JSON.
Runtime: **~5 s** (four chunks).

```
gold mentions:  65     predicted: 29     unverifiable: 0
overall:    P=0.759  R=0.338  F1=0.468  (tp=22 fp=7 fn=43)
persName:   P=0.789  R=0.294  F1=0.429  (tp=15 fp=4 fn=36)
placeName:  P=0.700  R=0.500  F1=0.583  (tp=7 fp=3 fn=7)
wrong-tag:  0
```

**Read:** **best result on this gold so far** — highest overall F1 (0.47), highest recall
(34%, 22/65), and best placeName recall (50%, 7/14). Faster than local or hosted Mistral (~5 s
vs ~84 s / ~16 s) with no wrong-tag confusions. Superseded by **suggest.v3** (see below).

### Groq — `qwen/qwen3.6-27b` + `suggest.v3` (2026-07-04)

Same gold file, same chunk settings, Groq API, prompt-only JSON. Runtime: **~5 s**.

```
gold mentions:  65     predicted: 54     unverifiable: 1
overall:    P=0.815  R=0.677  F1=0.739  (tp=44 fp=10 fn=21)
persName:   P=0.829  R=0.667  F1=0.739  (tp=34 fp=7 fn=17)
placeName:  P=0.769  R=0.714  F1=0.741  (tp=10 fp=3 fn=4)
wrong-tag:  0
```

**Read:** **new benchmark leader.** vs `suggest.v1` on the same model (F1=.47, R=.34, 29
predictions): recall roughly **doubled** (68% vs 34%), placeName 10/14 vs 7/14, precision
**improved** (~82% vs ~76%). Tag definitions + recall-oriented wording in `suggest.v3`; `suggest.v2`
(long “Do NOT” lists) collapsed to 0 predictions — avoid heavy negative instructions on Groq.
Still 21 FNs and 10 FPs to triage; no wrong-tag confusions.

### Local Ministral — `mistralai/ministral-3-8b` via LM Studio (2026-07-04)

Same gold file, same chunk settings, LM Studio at `localhost:1234`, `json_schema` structured
output.

**`suggest.v1`:** Runtime **~84 s**. 21 predicted, F1=0.372, placeName R=0.43.

**`suggest.v3`:** 9 predicted, 6 unverifiable, F1=0.189, placeName R=0.36 (5/14).

```
gold mentions:  65     predicted: 9      unverifiable: 6
overall:    P=0.778  R=0.108  F1=0.189  (tp=7 fp=2 fn=58)
persName:   P=0.500  R=0.039  F1=0.073  (tp=2 fp=2 fn=49)
placeName:  P=1.000  R=0.357  F1=0.526  (tp=5 fp=0 fn=9)
wrong-tag:  0
```

**Read:** **v3 regressed badly on local Ministral** vs v1 (F1 .19 vs .37) — far sparser output
and high unverifiable rate. Likely the longer v3 system prompt + `json_schema` path does not
transfer cleanly to the local 8B model; treat Groq Qwen3.6+v3 as the tuned default until local
is re-tested with a shorter Mistral-specific prompt variant.

### Hosted Mistral — `ministral-8b-2512` via API (2026-07-04)

Same gold file, same chunk settings, `https://api.mistral.ai`, `json_schema` structured output.
Use `MISTRAL_API_KEY` (see `liveTestEnv.ts` / `validationHarness.live.test.ts`).

**`suggest.v1`:** Runtime **~16 s**. 27 predicted, F1=0.348, placeName R=0.29.

**`suggest.v3`:** 31 predicted, F1=0.521, placeName R=0.57 (8/14).

```
gold mentions:  65     predicted: 31     unverifiable: 3
overall:    P=0.806  R=0.385  F1=0.521  (tp=25 fp=6 fn=40)
persName:   P=0.810  R=0.333  F1=0.472  (tp=17 fp=4 fn=34)
placeName:  P=0.800  R=0.571  F1=0.667  (tp=8 fp=2 fn=6)
wrong-tag:  0
```

**Read:** **v3 helps hosted Mistral** (+F1 from .35→.52, recall .25→.39, placeName 8/14 vs 4/14)
but still **well below Groq Qwen3.6+v3** (F1 .74, recall .68). Good second choice when you want
Mistral-family output or already have `MISTRAL_API_KEY`; Groq remains faster and stronger on
this gold with the current prompt.

### Side-by-side (`gold_test.xml`, 65 gold mentions, all `suggest.v3` unless noted)

| | **Groq Qwen3.6** | Hosted Mistral 8B | Local Ministral 8B | Groq Qwen3.6 v1 |
|---|---|---|---|---|
| Runtime | **~5 s** | ~16 s | ~84 s | ~5 s |
| Predicted | **54** | 31 | 9 | 29 |
| Overall P / R / F1 | **.82 / .68 / .74** | .81 / .39 / .52 | .78 / .11 / .19 | .76 / .34 / .47 |
| persName R | **.67** | .33 | .04 | .29 |
| placeName R | **.71** (10/14) | .57 (8/14) | .36 (5/14) | .50 (7/14) |
| wrong-tag | 0 | 0 | 0 | 0 |

**Summary:** **`suggest.v3` is tuned for Groq Qwen3.6-27B** — clear winner. Hosted Mistral
benefits from v3 but stays ~20 F1 points behind. Local Ministral **regressed** on v3 (keep v1
locally until a Mistral-specific prompt variant exists). All runs: no persName↔placeName
confusions.

## Recommended next steps (updated 2026-07-04)

1. ~~Prepare a short, completely hand-tagged gold passage~~ — **done:** `gold_test.xml`.
2. ~~Run model comparison + wire AI suggest UI~~ — **done** (Groq Qwen3.6 + v3 leads; dialog wired; `.ljb/ai-cache/` live).
3. **Immediate future — prompt profiles** — UI to edit/save per-model (and per-project) suggest prompts; cache key includes profile version. See [Auto-tagging.md](Auto-tagging.md) → AI mode → Immediate future **A**.
4. **Immediate future — expandable tags** — schema-driven tag picker; `tag-definitions.json` for `roleName`, `orgName`, …; extend gold + harness. See **B** in same section.
5. **Triage remaining errors** on current gold — Groq+v3: 21 FNs, 10 FPs.
6. **Local Ministral profile** — v3 regressed; ship a shorter Mistral-specific profile when prompt UI lands.
7. Set per-tag auto-accept confidence thresholds once prompt/tag tuning stabilizes.

Related memory: [[autotagging_phase5_ai_producers]].
