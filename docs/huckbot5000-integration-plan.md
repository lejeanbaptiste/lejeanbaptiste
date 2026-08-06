# Huckbot5000 + CBDB/Norbert integration — planning document

**Status (2026-08-06, afternoon):** Scaffolding complete and ready for the full LLM
generation run. Rights-hygiene work done earlier the same day. First production run was
killed mid-flight (period-keying bug); that bug and the CBDB/Norbert bridge are fixed. Old
partial candidates archived as `candidates.pre-reconcile.ndjson`. Procedural candidates
regenerated; ~11.7k LLM targets remain.

**This doc is the current-state summary — what to read to get oriented in five minutes.** The
full experimental history, numbers, and evidence behind every claim below lives in
[huckbot5000-planning.md](huckbot5000-planning.md); this doc doesn't repeat that detail, it
points to it. Pipeline mechanics:
[`authority extraction/huckbot5000/README.md`](../../authority%20extraction/huckbot5000/README.md).

---

## What we're doing

Chinese office titles (`roleName` entities, sourced from CBDB and Norbert) need English
translations in leaf-writer. Charles Hucker's *Dictionary of Official Titles in Imperial China*
is the standard scholarly reference; it remains under copyright, so **packs and releases we
publish must not redistribute his prose**. Huckbot5000 is a gap-fill pipeline: generate
candidate glosses for offices that still lack an English gloss in our publishable packs,
filter anything that matches known Hucker text, and ship only reviewed, distinctly
source-tagged output (`Huckbot5000`).

Two data sources need this, not one, and they don't cleanly line up:
- **CBDB** — broad coverage, has its own translations (some cited as `(Hucker)` in upstream
  data; those citations are omitted from packs *we* publish).
- **Norbert** — Han-through-Sui-and-beyond coverage, zero translations; appointment-derived dates
  for a subset of offices (see below).

---

## Where we're at

### Rights hygiene — done (policy refined same day)
- **Packs we publish** (`packs/cbdb/offices.ndjson`): `(Hucker)`-cited translations omitted in
  `compileRecords.mjs`, so our redistributable tagging packs do not carry that third-party prose.
- **CBDB installed for the user** (`stripReferenceDb.mjs` / `downloadCbdbDirect`): table-subset
  of CBDB's **official** release, left intact as published (including any `(Hucker)` citations
  CBDB itself includes). LJB reads office glosses from that local install the same way a user
  would consult CBDB directly. We do not re-package those strings into our GitHub pack assets.
- **Collision filter:** generated candidates are checked against Hucker OCR and CBDB's
  `(Hucker)`-cited fields. Matches are excluded from the publishable Huckbot5000 pack and
  retained only in a **local collision archive** (`packs/huckbot5000-insiders/`, tagged
  `source: 'Hucker'`, gitignored, not for redistribution) for provenance/audit. Leaf-writer
  does not load that archive yet.
- **Generation skips** offices CBDB already translates under a `(Hucker)` citation (covered by
  the user's CBDB install) and offices whose dynasty is already covered in the Hucker OCR corpus.
- **Still open:** three *live* GitHub releases still carry an old reference-person zip that
  predates the pack-side omit. Publishing a superseding release needs an explicit go-ahead.

### Feasibility and benchmarking — done
- Morpheme lexicon is real and mineable; rule-based composition abandoned (4.8% exact).
- Self-play numbers unreliable vs real API. **GPT-4o + retrieval** clears the rule-based floor
  (14.0% exact / 0.386 F1). Hand-rated adequacy ~57% adequate / ~19% wrong — budget ~1-in-5
  review rejection.

### Production pipeline — ready for full LLM run
Scripts in `authority extraction/huckbot5000/` (see that README for commands):

| Stage | What |
|---|---|
| Target resolution | `(headword, dynasty)` keys; concordance skips; Hucker OCR period skip; CBDB `(Hucker)` headword skip |
| Procedural | place+suffix (`太守`/`刺史`/`令`); allowlisted `parentOf` (`太子`/`公主`/`親王`) |
| LLM | GPT-4o + retrieval (`generate.mjs`) |
| Audit | collision + transliteration → review CSV |
| Compile | accepted CSV → `approved-include` → `translations.ndjson`; collisions → local archive |

**Killed first run:** headword-only dedupe bug; ~3,675 candidates archived as
`packs/huckbot5000/candidates.pre-reconcile.ndjson`. Do **not** `--resume` that file.

**Current queue (after skips + procedural, 2026-08-06):**

| | count |
|---|---|
| Resolved targets after all skips | ~11,850 |
| Procedural (place+suffix + parentOf) | ~192 |
| LLM remaining | ~11,658 |
| Skipped — Hucker OCR period covers dynasty | ~511 |
| Skipped — CBDB `(Hucker)` headword | ~3,137 |
| Norbert skipped via office concordance | 178 links |

Full generate (after commit):  
`OPENAI_API_KEY=... npm run generate:huckbot5000 -- --resume`  
then `npm run audit:huckbot5000`. Expect ~3–4 hours at ~1 call/s.

### CBDB/Norbert bridge — built
- **`deriveOfficeDates.mjs`** wired into `compile:norbert` / `reconcile:norbert-offices`
  (~1,375 dated offices from appointments).
- **`officeConcordance.mjs`** period-aware; undated Norbert links only when Hucker affirms
  continuity (`huckerOfficeContinuity.mjs`). **178** accepted links after that gate (was 397
  before the continuity filter).
- **`resolveTargets.mjs`** merges CBDB untranslated `(zh, dynasty)` groups with dated
  Norbert-only offices; no double generation for concordance-linked pairs.
- Boundary-touch at year 618 = same office (kept). Undated + Hucker-silent/distinct → no link;
  reconcile clears stale CBDB crosswalks.

### Procedural generation — built
- **place+suffix:** period-aware suffix glosses; place stem = concatenated toneless pinyin;
  conservative stem heuristics + blocklist (`遷安固太守`). Reviewed and accepted as correct.
- **parentOf (v1):** Norbert `office-relations` only (not CBDB office-type tree); allowlisted
  parents; `{Remainder} of the {Parent}`. Famous `太子…` compounds mostly collide with Hucker
  at audit (expected); only non-colliding rows stay for review.

### leaf-writer UI
- Phase 3 candidate period captions (`formatCandidatePeriod`) are built. Display of Huckbot
  glosses still waits on shippable `translations.ndjson`.

---

## Still open (not blocking the LLM run)

1. **Full LLM generate + human review** of the ~11.7k queue (this is the next action).
2. **`authoritypacks` release cut** — omit `(Hucker)`-cited CBDB fields from published packs +
   Norbert-only reference bundle; needs explicit go-ahead (independent of generation).
3. **Commit/push** pipeline code in `authority extraction` (and related leaf-writer docs/UI when
   ready).
4. Expanding `parentOf` allowlist beyond `太子`/`公主`/`親王` once non-Hucker compounds prove out.
5. Dating the remaining ~15k Norbert offices (expands targets later; does not invalidate this run).

---

## Goals, restated concretely

- Publishable packs never redistribute Hucker's dictionary prose — enforced by omitting
  `(Hucker)`-cited fields from our CBDB pack, dual-source collision filtering on generated
  candidates, and generation skip where CBDB/OCR already covers the office.
- Every generated translation is scoped to `(headword, dynasty)`, not shared across a headword's
  full historical range.
- CBDB and Norbert don't duplicate generation spend on offices already covered between them.
- Cheap mechanical patterns (place+suffix, allowlisted parentOf) are procedural, not LLM.
- Human review budgets for ~19% rejection, not the inflated self-play estimate.

---

## Reference

Full detail, all numbers, every experiment: [huckbot5000-planning.md](huckbot5000-planning.md).  
Pipeline how-to: [`authority extraction/huckbot5000/README.md`](../../authority%20extraction/huckbot5000/README.md).
