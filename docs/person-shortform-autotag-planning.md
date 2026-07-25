# Person short-form auto-tag (phase 2) — Planning

*2026-07-25. Follows from the name-type vocabulary in [`nameTypes.ts`](../packages/cwrc-leafwriter/src/autoTagging/nameTypes.ts), Tag bomb / disambiguation in `autoTagging/`, and the CBDB/Wikidata person-string policy in the sibling `authority extraction` repo.*

*Updated same day with three-bucket policy, custom name types, entities-panel backfill, and zh/ja/bo/en presets.*

## Problem

Full-form person names (`王安石`, `Daniel Morgan`) are safe enough to bombard a corpus with. Short forms are not:

- A bare 字 (`介甫`), 名 (`安石`), or Western given name (`Daniel`) collides constantly.
- Courtesy / style / given strings are often ordinary words or shared across many people.
- Some types (especially Chinese **family names / 姓**) are so ambiguous that auto-tagging should **never** hunt for them, even in a second pass.

So tagging is split into three buckets per name type, not two.

## Core idea — three buckets

Every canonical `NameTypeId` falls into exactly one bucket (project setting, language-aware labels):

| Bucket | Role | Example (Chinese default) |
|--------|------|---------------------------|
| **Phase 1** (full-form) | Seed Tag bomb / pack `searchStrings` | `primary`, long `art`, `posthumous`, `temple`, `dharma`, `pen`, `variant`, … |
| **Phase 2** (short-form) | After keyed disambiguation; entity-scoped seed; **always review** (incl. unique hits) | `courtesy`, `given`; short `art` (length-gated) |
| **Never** | Stored on the entity, searchable manually, **never** seeded by either auto-tag pass | `family` (姓) for Chinese |

Phase 2 also:

1. Seeds **only** from entities that already have at least one keyed mention in the active document (the “disambiguated keys”).
2. Optionally restricts matches to positions **at or after** that entity’s first keyed appearance (“start from first appearance”).
3. Reuses the existing disambiguation / review UI, filtering candidates by name-type.
4. **Allows single-character find-and-replace** — therefore even unique short-form hits go through review (no silent auto-accept). That is the safety net for 1-char 名/字 collisions with ordinary words.

Settings UI: per type, a three-way control (Phase 1 / Phase 2 / Never), not a single short-form checklist. Language-specific **labels** (字 / 名 / 姓; 字 / 通称 / 苗字; …). Language **presets** apply when the project source language is set (Chinese already exists; Japanese / Tibetan / English defaults below).

`primary` stays in Phase 1 (not selectable as Phase 2 / Never without a warning).

### Custom name types

Users may **add their own name types** (project-scoped), e.g. a corpus-specific honorific class or a local nickname category not in the built-in list.

- **Shape:** `{ id: string, label: string, labelsByLang?: Record<string, string>, bucket: 'phase1' | 'phase2' | 'never' }`.
- **`id`:** stable slug (`[a-z][a-z0-9_-]*`), unique within the project; written as TEI `@type` on `<persName>` the same way built-ins are.
- **Built-ins** remain fixed ids (`courtesy`, `given`, …); customs sit beside them in the same three-way UI and dropdowns (authorities panel, attributes panel).
- **Authority packs** still normalize only known Wikidata/CJK/… markers onto built-ins; customs are for manual assignment (and later optional user alias → custom id if we need it).
- **Reserved:** cannot shadow a built-in id; deleting a custom type that is still used on entities keeps the raw `@type` string on those names and shows it as “unknown / orphaned custom” until reassigned.
- **Storage:** project settings (`customNameTypes` + `nameTypeTaggingPolicy`), not hard-coded in `nameTypes.ts`.

### Length-gated `art` (號)

`art` is not a fixed bucket. At seed time:

- If code-point length ≥ threshold → treat as **Phase 1** (safe full-form style name, e.g. `半山老人`).
- If shorter → treat as **Phase 2** (risky short 號).

Threshold: start at **3** code points (matching the spirit of CBDB’s “longer than primary” / min-length guards); expose later if needed. Types in the **Never** bucket ignore length.

## Packs vs link-time enrichment

**Phase-1 `searchStrings` still omit bare 字 / 名 / 姓.** CBDB compile now emits those in `names[]` (see pack rebuild note below); matcher policy unchanged.

**Phase 2 needs short strings on the entity after linking** as typed `<persName type="…">` (and/or family/given notes).

| Source | What lands today | Gap |
|--------|------------------|-----|
| CBDB pack `names[]` | `王介甫` as `courtesy` (姓+字), longer art/…, **plus bare 字/名/姓** (pack B — compile in `authority extraction`) | Recompile installed CBDB pack into your entity DB folder to pick this up |
| Wikidata live fetch | P1782 bare 字, P735/P734 given/family | Offline / CBDB-only miss |
| Manual panel | `setNameType` / add typed name | Escape hatch |

**Pack rebuild (started):** CBDB compile now keeps `searchStrings` Phase-1-only and puts bare 字/名/姓 (and other short forms that failed length gates) in `names[]`. You still need to **recompile** and install the updated CBDB NDJSON in your entity DB folder; until then, Wikidata + manual typing cover many cases.

## Phase 2 mode (auto-tag dialog)

1. Collect `@key`s on `persName` in the active document (or selection).
2. Load those entities; gather Phase-2 strings (incl. length-gated `art`).
3. Dictionary-match (min length **1** for this pass only — single-character allowed).
4. Checkbox: **Start from first appearance** (default on).
5. **Every** hit goes to review / disambiguation (unique or not); filter candidates by name-type.

Nested text inside an existing `persName` stays skipped (`already-tagged`).

## Cross-language name-type concordance

Canonical ids stay language-neutral (`family`, `given`, `courtesy`, …). Labels and default buckets are language-aware. Local terms map onto the same ids (and a few gaps noted).

### Chinese (current `CJK_LABEL_TO_NAME_TYPE`)

| Local | Canonical | Default bucket |
|-------|-----------|----------------|
| 姓 / 姓氏 | `family` | **Never** |
| 名 | `given` | Phase 2 |
| 字 / 表字 | `courtesy` | Phase 2 |
| 號 / 別號 | `art` | length-gated |
| 諡號 | `posthumous` | Phase 1 |
| 廟號 | `temple` | Phase 1 |
| 法名 / 法號 | `dharma` | Phase 1 |
| 筆名 | `pen` | Phase 1 |
| 本名 / 原名 | `birth` | Phase 1 |

**Chinese default policy** (existing / keep): `family` → Never; `courtesy`, `given` → Phase 2; `art` → length-gated; everything else → Phase 1.

### Japanese

Reference: Basil Hall Chamberlain, [*Things Japanese* — “Names”](https://en.wikisource.org/wiki/Things_Japanese/Names) (Wikisource).

| Local (Chamberlain / common) | Canonical | Default bucket |
|------------------------------|-----------|----------------|
| 氏 / 苗字 (*uji* / *myōji*) | `family` | **Never** |
| 家名 (*kamyō*) | `family` | **Never** (same bucket; alone is as ambiguous as 苗字) |
| 俗名 / 通称 (*zokumyō* / *tsūshō*) | `given` | Phase 2 |
| 呼び名 (*yobi-na*) | `given` | Phase 2 |
| 名乗 / 実名 (*nanori* / *jitsumyō*) | `primary` when headword, else `given` | Phase 1 / Phase 2 by assigned type |
| 幼名 (*yōmyō*) | `birth` | Phase 2 (short childhood names) |
| 諱 (*imina*) | `birth` | Phase 2 |
| 字 (*azana*) | `courtesy` | Phase 2 |
| 号 / 俳名 / 画号 (*gō*, …) | `art` | length-gated |
| 送り名 (*okuri-na*) | `posthumous` | Phase 1 |
| 法名 / 戒名 | `dharma` | Phase 1 |
| 芸名 (*geimyō*) | `pen` | Phase 1 (stage names are usually distinctive multi-mora strings) |

**Japanese default policy:** Never = `family`; Phase 2 = `courtesy`, `given`, `birth`; `art` length-gated; else Phase 1.

### Tibetan

| Local | Canonical | Default bucket |
|-------|-----------|----------------|
| རུས་ / རུས་པ (*rus* / *rus-pa*) | `family` | **Never** |
| མཁན (*mkhan*) | *(not a name type)* | Office / `roleName` — out of scope |
| མིང (*mying*), མཚན (*mtshan*) | `primary` / `given` | Phase 1 / Phase 2 by assigned type |
| ཆོས་མིང (*chos-ming*) | `dharma` | Phase 1 |
| གཅེས་མིང (*gces-ming*) | `variant` | Phase 2 (affectionate; often short) |
| མཚང་མིང (*mtshang-ming*) | `variant` | Phase 2 (nickname) |

**Tibetan default policy:** Never = `family`; Phase 2 = `given`, `variant` (covers affectionate + nickname until/unless split); `art` length-gated if used; `courtesy` / `birth` → Phase 2 when present; else Phase 1 (`dharma`, `primary`, `pen`, …).

### English (for completeness)

Never = `family`; Phase 2 = `given`; `art` length-gated; else Phase 1.

## Locked decisions

| # | Decision |
|---|----------|
| Family / clan | Third bucket **Never** (zh 姓; ja 苗字/家名; bo *rus*). |
| `art` / 號 / 号 | **Length-gated** (short → Phase 2, long → Phase 1). |
| Unique Phase-2 hits | **Always review** — Phase 2 allows single-character match. |
| Pack rebuild for all typed names | **OK to defer**; modify CBDB/Wikidata later. |
| Custom name types | **Allowed** — project-scoped ids + labels + bucket. |
| Language presets | **zh** as today; **ja** / **bo** / **en** as decided above. |
| Backfill | **Button on the entities panel** (see below). |

## Backfill — entities panel button

Entities linked before enrichment will lack bare 字/名. Do **not** block Phase 2 on a mandatory mass rebuild; Phase 2 simply skips people with no Phase-2-typed strings.

**UI:** a **Backfill names from authorities** control on the entities panel (database sidebar), not only buried in settings:

- Runs over PEDB persons that have linkable idnos (CBDB / Wikidata / …).
- Reuses link-time collectors (`collectTypedNamesForCandidate`, given/family).
- Progress + cancel; non-destructive (adds missing typed names / notes, does not overwrite user-edited types).
- Optional later: same action scoped to the **currently selected entity** only (“Refresh this person”).
- Best results once pack `names[]` carries bare forms; until then Wikidata-linked people benefit most — copy can say so.

**Storage field:** migrate to `nameTypeTaggingPolicy` map + `customNameTypes[]`. Read fallback: old `excludedNameTypes` → those types become `phase2`, and language default still forces `family` → `never`.

Scope of keyed entities for Phase 2 seed: **active document / selection** for v1.

## Phasing

| Phase | Work |
|-------|------|
| **A — Settings + three buckets** | **Done (2026-07-25).** Policy model + Tag bomb/PEDB filtering + Settings UI (`desktop-name-type-policy.tsx`). |
| **B — Link enrichment** | Bare 字/名/姓 onto entities at link (pack `names[]` and/or CBDB fields); can follow pack rebuild. |
| **C — Phase 2 mode** | **Done (2026-07-25).** Dialog method; min-length 1; first-appearance checkbox; **always** review; name-type-filtered candidates. |
| **D — Backfill + labels** | **Done (2026-07-25).** Entities-panel backfill button; ja/bo label glosses in dropdowns; per-entity refresh in edit dialog. |

## Acceptance (v1)

- Each name type is Phase 1, Phase 2, or Never; Never never seeds either pass.
- Length-gated `art`: short forms only appear in Phase 2 seed.
- Phase 2 never auto-accepts; single-character hits are reviewable.
- “Start from first appearance” respected.
- Disambiguation lists only people for whom the surface is typed in an allowed Phase-2 class.

## Open questions

1. **`variant` and untyped legacy** — **Locked:** untyped names → Phase 1 only; Tibetan preset puts `variant` in Phase 2.
2. **Art length threshold** — **Locked:** 3 code points (`DEFAULT_ART_MIN_CODEPOINTS`).
3. **Custom type id rules** — **Locked:** ASCII slug (`[a-z][a-z0-9_-]*`) + separate display label; cannot shadow built-in ids.
4. **Split Tibetan affectionate vs nickname** — only if users need different buckets; until then both → `variant`, or user adds customs.

## Related code (current)

| Piece | Role |
|-------|------|
| `autoTagging/nameTypes.ts` | Canonical types; today only binary `DEFAULT_UNTAGGABLE_TYPES` |
| `autoTagging/authoritySettings.ts` | Persists policy map + custom types; legacy `excludedNameTypes` migration |
| `autoTagging/nameTypeTaggingPolicy.ts` | Three-bucket model, presets, phase-1 seed filtering |
| `autoTagging/entityOps.ts` | `taggableEntityNames`, `setNameType` |
| `autoTagging/disambiguationCandidates.ts` | Link-time typed names |
| `autoTagging/ownDatabaseCandidates.ts` | PEDB→candidates; ignores name types today |
| `authority extraction/cbdb/personAltNames.mjs` | `buildPersonNamesFromAlts`: 姓+字 in searchStrings; bare 字/名/姓 in `names[]` only |
