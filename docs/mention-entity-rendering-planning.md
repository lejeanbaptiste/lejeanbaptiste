# Mention-faithful entity rendering

Design note for LJBtero translation entity chips (implemented 2026).

## Problem

`collectEntitiesFromSourceUnitXml` deduped by entity key, and `substituteEntityPlaceholders` always used canonical `createEntityFieldElement` with `EMPTY_DISPLAY_SPEC`. A courtesy name (景撝), a partial given (廓), or a place as written (濟陽) all collapsed to the DB’s canonical short form.

## Approach

1. **Mention manifest** — one `MentionContext` per keyed source span, in document order (keys may repeat).
2. **Blinding** — `{{mention:N}}` (+ `{{holding:N}}` / `{{as:N}}` for offices); AI payload is `{ index, kind }` only.
3. **Role resolution** — match `teiType` + surface against DB name rows (`nameRole`); courtesy, partial-given, dharma, `*-as-written`.
4. **File-wide occurrence** — first mention in the companion file gets Chinese + life dates (Western) or CJK dates; later mentions shorten.
5. **Brackets policy** — user setting per language bucket: inferred family on partial names (`[Cai] Kuo` Western; `（蔡）廓` CJK).
6. **Shared renderer** — AI substitute, toolbar insert, and autocomplete all call `buildWesternMentionParts` / `buildCjkMentionParts` → `createMentionFieldElement`.

## Key modules

| Module | Role |
|--------|------|
| `mentionContext.ts` | Types, collector, role resolver, `deriveDisplaySpec` |
| `mentionRender.ts` | Western + CJK part builders, `formatEntityDatesCjk` |
| `mentionSubstitute.ts` | Replace `{{mention:N}}` in AI output |
| `fileWideOccurrence.ts` | Count prior refs in companion doc |
| `openccScriptNormalize.ts` | Lazy OpenCC (`t2s`, `t2jp`); installed via Chinese/Japanese asset packs |
| `scriptNormalize.ts` | Thin wrapper + `familyHanForEntity` |
| `sourceUnitEntities.ts` | Blinding emits manifest |

## Persisted field attrs

- `data-mention-surface` — source characters
- `data-mention-role` — resolved `MentionRole`
- `data-display-spec` — brackets / hidden parts recipe

## Out of scope (for now)

- Post-generation accept/reject UI for entity wording
- Full ja/ko date wording polish (zh defaults ship first)
