# Auto-tagging — milestone projection matcher

**Status (2026-09-02):** Phase A–**C** implemented (`projectionIndex.ts`,
`dictionaryTagProjection`, `wrapProjectionRange`, flag off by default). CBETA import
keeps `<lb>` / `<pb>` / empty `<anchor>` in the XML; production matching still runs
**per text node** via `dictionaryTag` unless `useProjectionMatcher` is enabled on the
tag bomb. Phases D–E remain before full wire-in.

**Rollout:** build the projection stack in parallel, regression-test against
today’s matcher on plain TEI, wire in only when mature (project setting, default
off).

**Related:** [cbeta-import-planning.md](cbeta-import-planning.md) (§ auto-tagger
requirement), [Auto-tagging.md](Auto-tagging.md), [sanmiao-ljb-integration.md](sanmiao-ljb-integration.md)

---

## Problem

CBETA (and similar) texts interleave running prose with empty milestones:

```xml
《般舟三<lb n="0324b25" ed="T"/>
昧》
```

An `<lb>` is an element, so the DOM has two text nodes (`《般舟三` and `昧》`).
Neither node contains the full string `般舟三昧`.

Today:

| Producer                             | Match                               | Apply                                                              |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------ |
| Authority tag bomb (`dictionaryTag`) | Per text node only                  | Single-node `wrapRange`                                            |
| AI suggest / audit                   | Document-level chunk text           | `locateInDoc` rejects spans crossing nodes                         |
| Sanmiao dates                        | Document-level `index.text` on send | `offsetToRawRange` requires single-node span                       |
| Person-wrapper compound pass         | Document-level `index.text`         | `add-compound` wraps adjacent **elements**, not `text + lb + text` |

**Workaround today:** check **Strip Taishō line breaks** on CBETA import (removes
`<lb>`, joins text). That fixes matching but drops line-level citation markers in
running text.

---

## Desired architecture

1. **Build a projection** — a flat search string from body text, skipping (not
   deleting) empty _infrastructure_ elements: **`lb`, `pb`, empty `anchor`, `gap`**
   (all bridged for matching). Map each projection index back to a DOM text node
   + raw offset; record skipped infrastructure for wrap apply.
2. **Match on the projection** — reuse `MultiStringMatcher` / authority seed
   index on `projection.text` (longest-first, document-order occurrence counting).
3. **Apply by wrapping the DOM range** — insert the entity tag around the
   contiguous run of nodes from start boundary through end boundary, **keeping**
   milestones inside the tag when they fall within the span, e.g.
   `<title>般舟三<lb …/>昧</title>` or
   `<persName>王<lb/>安<pb n="…"/>石</persName>`.

**`<choice>` / `<sic>` / `<corr>` (Norbert-style):** projection uses the
**corrected reading only** (same rule as `hiddenChoiceText.ts` — exclude
`<sic>` and `<surplus>`). Match and disambiguate on `<corr>` text; Phase C apply
wraps the **corr branch** while preserving `<sic>` as a sibling inside
`<choice>`. No global sic→attribute shuffle required if tags land inside
`<corr>`.

Sanmiao already follows step 1 on the **read** side (plain extracted text sent to
Python). This plan completes the loop for **named-entity** tagging and fixes
Sanmiao **apply** for date strings split by `<lb>` / `<pb>`.

---

## What already exists (partial building blocks)

| Piece                                   | Location                           | Role                                                                                     |
| --------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `buildProjectionIndex`                  | `autoTagging/projectionIndex.ts`   | Phase A — flat text + per-char DOM map + infrastructure marks (**not wired**)            |
| `buildDocIndex`                         | `autoTagging/anchor.ts`            | Concatenates text-node search strings; `<lb>` contributes nothing but still splits nodes |
| `hiddenChoiceText.ts`                   | `autoTagging/`                     | corr-only surface for disambiguation / Sanmiao send                                      |
| `INFRASTRUCTURE_TAGS`                   | `autoTagging/purge.ts`             | `lb`, `pb`, `anchor`, `milestone`, … — used by Tag Transform, not autotag                |
| `createCompoundAnchor` / `add-compound` | `anchor.ts`, `apply.ts`, `seed.ts` | Cross-node anchors for Norbert person-wrappers (sibling elements)                        |
| `buildTaggableDocIndex`                 | `dateTeiHelpers.ts`                | Excludes text inside `<date>`                                                            |
| `offsetToRawRange`                      | `dates.ts`                         | Single-node only; same limitation as `locateInDoc`                                       |
| CBETA planning note                     | `cbeta-import-planning.md`         | “plain-text projection … re-insert NE tags around the milestones”                        |

---

## Disadvantages and risks

Not a reason to avoid the architecture, but worth designing for:

1. **Projection ≠ literal XML** — collapsing across milestones assumes the break
   is pagination noise, not a semantic boundary. Wrong spans are still possible
   across verse layout; **`<pb>` is bridged by design** (a name split by a page
   break should still tag).
2. **Apply complexity** — wrapping mixed `text | lb | pb | text` without losing
   nodes; stable bidirectional offset maps; harder undo and review “jump to mention”.
3. **Re-anchoring** — compound start/end boundaries; more `unresolvable` after
   edits. `createCompoundAnchor` end-offset snapping is already incomplete
   (see root `readme.md` Future).
4. **Further markup** — `g` / gaiji, ruby, notes still need explicit rules
   (Phase A: ordinary text nodes only; gaiji deferred).
5. **Tags containing milestones** — valid TEI-ALL, but visual mode, export, and
   downstream tools may render `lb` / `pb` inside `persName` unexpectedly.
6. **Two representations** — projection and live DOM must stay aligned through
   import, visual round-trip, and batch apply.

**vs strip `<lb>` on import:** simpler and works with today’s matcher; loses
Taishō line refs at those points in the working file.

---

## Proposed phases

### Phase A — Projection index (read path)

- [x] `buildProjectionIndex(root, policy, options)` → `{ text, points, infrastructure }`
      (`projectionIndex.ts`).
- [x] Bridge empty **`lb`, `pb`, `anchor`, `gap`** (no hard boundary on `pb`).
- [x] Exclude `<sic>` / `<surplus>`; exclude `<teiHeader>` and `<date>` text.
- [x] Unit tests: `般舟三<lb/>昧`, `王<pb/>安石`, `<choice><sic>…</sic><corr>…</corr></choice>`,
      parity with `buildDocIndex` on plain paragraphs.

### Phase B — Authority tag bomb on projection

- [x] `dictionaryTagProjection()` — scan `projection.text` once (parallel to
      `dictionaryTag`, do not replace until wired).
- [x] Emit suggestions with compound boundaries when span crosses text nodes
      (`endXpath` / `endOffset` or projection-native anchor).
- [x] Parity test: plain TEI without milestones → identical suggestions to
      current matcher.
- [x] Wire behind project flag in `seedSuggestionsFromIndex` (default off).

### Phase C — Apply across infrastructure

- [x] `wrapProjectionRange(doc, start, end, tag)` — walk siblings from start
      through end; preserve `lb` / `pb` / empty anchors inside the span.
- [x] `<choice>`: wrap `<corr>` content; leave `<sic>` sibling intact.
- [x] Schema + user-rule checks on the **parent** of the wrapped run.
- [x] Tests mirroring CBETA example and `persName` with internal milestones.

### Phase D — AI + Sanmiao parity

- [ ] Shared `locateInProjection` (replace `locateInDoc` / `offsetToRawRange`
      single-node guard).
- [ ] Sanmiao date proposals that straddle `<lb>` / `<pb>` apply instead of silent skip.

### Phase E — Settings & UX

- [ ] Project setting: “Match across line and page breaks” (default off until
      B+C are validated).
- [ ] Link from CBETA import dialog to this behaviour vs strip-`lb` import.

---

## Open questions

1. **Collation anchors** — with **clean import**, inline `beg`/`end` anchors are
   stripped; without clean, should non-empty anchors be bridged or hard boundaries?
2. **`<g>` / gaiji** — projection should use resolved Unicode (matching display
   text); map offsets back through the original `<g>` node.
3. **Visual editor** — confirm TinyMCE body DOM matches XML DOM structure for
   milestone placement before relying on wrap apply in visual mode.

---

## Acceptance (phase B+C minimum)

Re-import or hand-build a file containing `《般舟三<lb …/>昧》` with **clean
import** and **strip lb unchecked**. Authority tag bomb suggests `般舟三昧` (or
the full work title if in packs) and apply produces a single tag spanning both
text nodes with `<lb>` preserved inside.

Hand-build `<choice><sic>王尭</sic><corr>王<lb/>堯</corr></choice>`: match on
`王堯`, apply yields `<corr><persName>王<lb/>堯</persName></corr>` with `<sic>`
unchanged.

---

## Code touchpoints

- `packages/cwrc-leafwriter/src/autoTagging/projectionIndex.ts` — Phase A index (**done**)
- `packages/cwrc-leafwriter/src/autoTagging/anchor.ts` — compound boundaries
- `packages/cwrc-leafwriter/src/autoTagging/dictionary.ts` — projection scan mode
- `packages/cwrc-leafwriter/src/autoTagging/projectionApply.ts` — Phase C wrap apply (**done**)
- `packages/cwrc-leafwriter/src/autoTagging/apply.ts` — projection `add` branch
- `packages/cwrc-leafwriter/src/autoTagging/dates.ts` — projection-aware raw range
- `packages/cwrc-leafwriter/src/autoTagging/llmParse.ts` — `locateInDoc`
- `packages/cwrc-leafwriter/src/autoTagging/hiddenChoiceText.ts` — corr-only policy (shared)
