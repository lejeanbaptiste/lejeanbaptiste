# Phase 5 AI integration — work log and provider options

Running reference for the AI-suggest/AI-audit work under [Auto-tagging-phases.md](Auto-tagging-phases.md)
→ Phase 5. Consolidates what was decided, what was built, what live testing has shown so far,
and the provider/free-tier landscape — so none of it has to be re-derived next session.
Methodology and full first-run numbers for the validation harness specifically are in
[phase5-validation-results.md](phase5-validation-results.md); this doc is the broader summary.

## Decisions (2026-07-04)

- **Provider: Mistral family only for v1.** A local Ministral model (served via an
  Ollama-compatible / OpenAI-compatible endpoint — tested via LM Studio) for free/no-cost
  development, with the hosted Mistral API as the BYO-key fallback for users without local
  hardware. No Anthropic/frontier-model spend yet.
- **NER dropped from Phase 5 scope** — stays in "Deferred/future." GuwenBERT and similar
  encoder-only classical-Chinese models belong there, not in the current architecture (see
  "Where GuwenBERT fits" below).
- **Separate prompts per task** (suggest, audit, later translation), sharing only a preamble —
  not stacked. A small local model degrades under multi-objective instructions, the output
  shapes genuinely differ, and stacking would invalidate the whole cache whenever one task's
  instructions change.
- **Structural, non-overlapping chunking** — cut only at block-element boundaries, never
  fixed-size-with-overlap, so occurrence counting stays unambiguous.
- **Cache key:** `(chunk hash, tag set, model, prompt version)`, `.ljb/ai-cache/`, mirrors the
  Phase 4b authority cache.
- **Two-layer validation** on every model claim: schema/field validation, then anchor
  verification against the live document. Anything failing either is dropped and counted,
  never applied.

## What's built

At `packages/cwrc-leafwriter/src/autoTagging/`:

| File | Role |
|---|---|
| `chunk.ts` | Structural, non-overlapping chunking with a context margin |
| `llmClient.ts` | `LlmClient` interface + `OllamaLlmClient` + `MistralLlmClient` (also reused for any OpenAI-compatible local server — LM Studio, Groq, etc.) |
| `prompts.ts` | Versioned `suggest.v1`/`audit.v1` prompts, shared preamble |
| `llmCache.ts` | `(chunk hash, tags, model, prompt version)` cache |
| `llmParse.ts` | Schema validation + anchor-verification helpers |
| `llmSuggest.ts` | AI suggest producer — plain `add` suggestions, no ids |
| `llmAudit.ts` | AI audit producer — renders existing tags inline, emits `add`/`remove`/`retag`/`redraw-boundary` |
| `validationHarness.ts` | Precision/recall scoring against a hand-tagged document |
| `validationHarness.live.test.ts` | Opt-in live harness (`LLM_LIVE_TEST=1`); default gold: `test_project/corpus_a/gold/gold_test.xml` |

44+ tests across these files (harness plumbing + 11 on scoring math), all passing;
typecheck clean (one pre-existing, unrelated `integration.ts` error untouched).

**Groq client notes (2026-07-04):** `MistralLlmClient` auto-detects Groq (`baseUrl` contains
`groq.com`): sets `reasoning_effort: none` for Qwen models (reasoning breaks JSON output),
defaults to **prompt-only JSON** (no `response_format`), retries without format on
`json_validate_failed`. LM Studio / hosted Mistral still use `json_schema`. Run harness:

```bash
# Groq (export GROQ_API_KEY once per shell session)
LLM_LIVE_TEST=1 \
  LLM_LIVE_BASE_URL=https://api.groq.com/openai LLM_LIVE_MODEL=qwen/qwen3-32b \
  NODE_OPTIONS=--no-experimental-strip-types \
  npx jest --selectProjects Core --testPathPatterns=validationHarness.live.test

# Local Ministral (LM Studio)
LLM_LIVE_TEST=1 LLM_LIVE_BASE_URL=http://localhost:1234 \
  LLM_LIVE_MODEL=mistralai/ministral-3-8b \
  NODE_OPTIONS=--no-experimental-strip-types \
  npx jest --selectProjects Core --testPathPatterns=validationHarness.live.test

# Mistral hosted API (json_schema — same path as LM Studio)
LLM_LIVE_TEST=1 LLM_LIVE_BASE_URL=https://api.mistral.ai \
  LLM_LIVE_MODEL=ministral-8b-2512 \
  MISTRAL_API_KEY=... \
  NODE_OPTIONS=--no-experimental-strip-types \
  npx jest --selectProjects Core --testPathPatterns=validationHarness.live.test
# Use MISTRAL_API_KEY for Mistral; Groq uses GROQ_API_KEY (unset LLM_LIVE_API_KEY if it still holds a Groq gsk_… key).
```

**Still open:** auto-accept rules storage/UI; dialog/method-chooser wiring (API-key/local-endpoint
settings, greyed-out-until-configured AI method); `apply.ts` doesn't yet handle `remove`/`retag`/
`redraw-boundary` (only `add` is applied today — audit's other actions reach the review walk
correctly shaped but need an apply-engine branch); hand-testing audit prompts live.

## Live testing so far

Both runs used `mistralai/ministral-3-8b` via LM Studio (OpenAI-compatible local endpoint),
against the full `sizhu_shang.xml` (~24 KB), chunked at `targetChars: 800` / `marginChars: 100`,
no persistent cache (fresh model calls every chunk).

**Suggest-only pass:** 131 verified suggestions, 18 dropped as unverifiable, ~13 minutes.
Quality was encouraging — real names, deities, and mythological place names correctly typed —
with the expected noise at low confidence (numerals and titles mistagged as `persName`, exactly
the kind of case an auto-accept confidence threshold is meant to catch).

**Validation harness pass:** scored against the document's own existing tags —

```
gold mentions:  100     predicted: 138     unverifiable: 28
overall:    P=0.355  R=0.490  F1=0.412  (tp=49 fp=89 fn=51)
persName:   P=0.358  R=0.630  F1=0.456  (tp=34 fp=61 fn=20)
placeName:  P=0.349  R=0.326  F1=0.337  (tp=15 fp=28 fn=31)
```

**The number that matters most:** the gold tagging in this document is incomplete (100 gold
mentions vs. 131 candidates from the suggest-only pass on the same text), so **measured
precision is a floor, not a trustworthy figure** — an untagged-but-real entity scores as a false
positive. Recall is the reliable half: missing 37% of already-known persName and 67% of
already-known placeName is a real gap regardless of gold completeness, and placeName
underperforming persName across the board is worth investigating on its own (prompt wording vs.
genuine model weakness on the mythological/cosmological place names common in this text).

Full methodology for the `sizhu_shang` run and the incomplete-gold caveat are in
[phase5-validation-results.md](phase5-validation-results.md).

### Gold-standard comparison — `gold_test.xml` (2026-07-04)

Exhaustively tagged 後漢書·鄭玄 passage (`test_project/corpus_a/gold/gold_test.xml`), **65 gold
mentions**, same chunk settings (`800` / `100`). First apples-to-apples model comparison with
trustworthy precision and recall:

| | Groq Qwen3-32B | **Groq Qwen3.6-27B** | Local Ministral 8B | Hosted Mistral 8B |
|---|---|---|---|---|
| Runtime | ~1.5 s | **~5 s** | ~84 s | ~16 s |
| Predicted | 8 | **29** | 21 | 27 |
| Overall P / R / F1 | .75 / .09 / .16 | **.76 / .34 / .47** | .76 / .25 / .37 | .59 / .25 / .35 |
| persName recall | .12 | **.29** | .20 | .24 |
| placeName recall | .00 | **.50** | .43 | .29 |

**Takeaway:** **Groq Qwen3.6-27B is the new default for harness iteration** — best F1, recall,
and placeName on this gold (~5 s, free tier). Qwen3-32B is too sparse. Local/hosted Mistral 8B
still viable but no longer top recall. Prompt tuning is the next lever. Full write-up in
[phase5-validation-results.md](phase5-validation-results.md).

## Provider / free-tier options

Explored once the local-only path raised the "should we test a bigger model" question. Two
axes: local (free, hardware-bound, unlimited) vs. hosted free tiers (free, but rate-limited).

### Local models (beyond Ministral)

All speak the same OpenAI-compatible `/v1/chat/completions` shape via LM Studio/Ollama, so any
of these drop into the existing `MistralLlmClient` with just a model-name/`baseUrl` change:

- **Qwen2.5/Qwen3** (7B–14B range) — strong classical/literary Chinese, reliable structured
  JSON output, different training lineage from Mistral (a genuinely independent comparison
  point, not just a size change).
- **GLM-4** (Zhipu) — also strong on Chinese, runnable at smaller sizes locally.
- **DeepSeek-R1-distill-Qwen-7B** — reasoning-tuned distill; worth trying on the
  name-vs-title judgment calls the placeName gap suggests.

### Where GuwenBERT fits (it doesn't, in the current architecture)

GuwenBERT is an encoder-only, masked-LM-style model pretrained on classical Chinese — it can't
be prompted for JSON the way Ministral/Qwen can. Using it means fine-tuning a token-classification
head, which is a real NER pipeline, not another `LlmClient` implementation. That's the item
already flagged as deferred ("NER via user-supplied language models... Future") in
[Auto-tagging.md](Auto-tagging.md), not part of the current suggest/audit path.

### Hosted free tiers

| Provider | Free-tier limits (as documented) | Practical read |
|---|---|---|
| **Groq** — `qwen/qwen3.6-27b` | 250K TPM, 1K RPM (official docs) | **Best gold run so far** (~5 s on `gold_test.xml`, F1=.47). Use instead of deprecated `qwen/qwen3-32b`. |
| **Groq** — `qwen/qwen3-32b` | 300K TPM, 1K RPM | Deprecates **2026-07-17**; too sparse on gold (8 predictions). |
| **Groq** — `llama-3.3-70b-versatile` | 30 RPM, 1,000 RPD, 12,000 TPM, 100,000 TPD | Bigger model, lower daily token cap (~8 chunks/day at that rate) — usable for spot checks, not full-document runs. |
| **Mistral hosted free tier** | Not officially published anymore (docs point to Admin Console → Limits); third-party trackers cite **~2 RPM, ~1B tokens/month** | If that figure holds, the token cap is irrelevant at this scale, but 2 RPM means a single 30-chunk document takes **~15 minutes from throttling alone** — no better than the local run. Verify actual numbers in your own Admin Console before relying on this. |

**Recommendation (updated 2026-07-04, Qwen3.6 gold run):** Use **Groq `qwen/qwen3.6-27b`** as the
default for prompt iteration on the harness — best F1/recall/placeName on `gold_test.xml`, ~5 s,
free tier, `GROQ_API_KEY` auto-detected. Local Ministral 8B remains a fallback when offline.
Hosted Mistral `ministral-8b-2512` is fine when you need Mistral-family output. Avoid
`qwen/qwen3-32b` (deprecated 2026-07-17, too sparse).

## Next steps (updated 2026-07-04)

1. ~~Gold passage + model comparison~~ — **done** (four models in validation-results doc; Qwen3.6 leads).
2. **Prompt tuning** — Qwen3.6 still misses 43/65 gold mentions; triage 7 FPs.
4. Wire `.ljb/ai-cache/` into harness runs before prompt iteration.
5. `sizhu_shang` 89-FP triage still optional (incomplete gold there).
6. Auto-accept rules, dialog wiring, `apply.ts` audit actions — still open.

Related memory: [[autotagging_phase5_ai_producers]].
