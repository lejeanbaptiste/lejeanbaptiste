# Auto-tagging — milestone projection matcher

**Status (2026-09-01):** Planning only. CBETA import keeps `<lb>` / `<pb>` / empty
`<anchor>` in the XML; the authority tag bomb and AI suggest paths still match
**per text node** (or drop cross-node spans on apply). A plain-text projection
matcher — match on collapsed text, wrap tags around infrastructure milestones —
is the agreed direction for citation-faithful corpora but **not implemented**.

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
   deleting) configured _infrastructure_ elements: at minimum empty `lb`, empty
   `anchor`, `gap`; optionally `pb` (see open questions). Map each projection
   index back to a DOM position (text node + raw offset, or a boundary record).
2. **Match on the projection** — reuse `MultiStringMatcher` / authority seed
   index on `projection.text` (longest-first, document-order occurrence counting).
3. **Apply by wrapping the DOM range** — insert the entity tag around the
   contiguous run of nodes from start boundary through end boundary, **keeping**
   milestones inside the tag when they fall within the span, e.g.
   `<title>般舟三<lb …/>昧</title>`.

Sanmiao already follows step 1 on the **read** side (plain extracted text sent to
Python). This plan completes the loop for **named-entity** tagging and fixes
Sanmiao **apply** for date strings split by `<lb>`.

---

## What already exists (partial building blocks)

| Piece                                   | Location                           | Role                                                                                     |
| --------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `buildDocIndex`                         | `autoTagging/anchor.ts`            | Concatenates text-node search strings; `<lb>` contributes nothing but still splits nodes |
| `INFRASTRUCTURE_TAGS`                   | `autoTagging/purge.ts`             | `lb`, `pb`, `anchor`, `milestone`, … — used by Tag Transform, not autotag                |
| `createCompoundAnchor` / `add-compound` | `anchor.ts`, `apply.ts`, `seed.ts` | Cross-node anchors for Norbert person-wrappers (sibling elements)                        |
| `buildTaggableDocIndex`                 | `dateTeiHelpers.ts`                | Excludes text inside `<date>`                                                            |
| `offsetToRawRange`                      | `dates.ts`                         | Single-node only; same limitation as `locateInDoc`                                       |
| CBETA planning note                     | `cbeta-import-planning.md`         | “plain-text projection … re-insert NE tags around the milestones”                        |

---

## Disadvantages and risks

Not a reason to avoid the architecture, but worth designing for:

1. **Projection ≠ literal XML** — collapsing across milestones assumes the break
   is pagination noise, not a semantic boundary (verse, paragraph layout). Wrong
   spans are possible across `<pb>` in particular.
2. **Apply complexity** — wrapping mixed `text | lb | text` without losing nodes;
   stable bidirectional offset maps; harder undo and review “jump to mention”.
3. **Re-anchoring** — compound start/end boundaries; more `unresolvable` after
   edits. `createCompoundAnchor` end-offset snapping is already incomplete
   (see root `readme.md` Future).
4. **Infrastructure rules** — `g`, `choice`/`sic`, ruby, notes each need an
   explicit rule (too much stripping → false matches from hidden text; too little
   → split strings remain).
5. **Tags containing milestones** — valid TEI-ALL, but visual mode, export, and
   downstream tools may render or handle `lb` inside `persName` unexpectedly.
6. **Two representations** — projection and live DOM must stay aligned through
   import, visual round-trip, and batch apply.

**vs strip `<lb>` on import:** simpler and works with today’s matcher; loses
Taishō line refs at those points in the working file.

---

## Proposed phases

### Phase A — Projection index (read path)

- [ ] `buildProjectionIndex(root, policy, options)` returning `{ text, map }`
      where `map[i]` describes how projection offset `i` maps to the DOM (extend
      `DocIndex` or parallel type).
- [ ] Config: `skipTags` default `lb`, empty `anchor`, `gap`; `hardBoundaryTags`
      default `pb` (do not match across until explicitly enabled).
- [ ] Unit tests: `般舟三<lb/>昧` → `般舟三昧` in projection; `pb` boundary;
      nested `persName` unchanged.

### Phase B — Authority tag bomb on projection

- [ ] Scan `projection.text` with `MultiStringMatcher` (not per-node
      `dictionaryTag` loop).
- [ ] Emit suggestions with compound boundaries when span crosses text nodes
      (new action or extend `add` with `endXpath` / `endOffset`).
- [ ] Wire into `runAuthorityTagBombOnDocument` / `seedSuggestionsFromIndex`.

### Phase C — Apply across infrastructure

- [ ] `wrapProjectionRange(doc, start, end, tag)` — walk siblings from start
      text offset through end, moving nodes into the new element; preserve `lb` /
      empty anchors inside the span.
- [ ] Schema + user-rule checks on the **parent** of the wrapped run.
- [ ] Tests mirroring CBETA example and `persName` with internal `anchor` pairs.

### Phase D — AI + Sanmiao parity

- [ ] Replace `locateInDoc` / `offsetToRawRange` single-node guard with
      projection-aware locator (or shared helper).
- [ ] Sanmiao date proposals that straddle `<lb>` apply instead of silent skip.

### Phase E — Settings & UX (optional)

- [ ] Project setting: “Match across line breaks” / “Match across page breaks”.
- [ ] Link from CBETA import dialog copy to this behaviour vs strip-`lb` import.

---

## Open questions

1. **`<pb>`** — hard boundary by default, or bridge like `<lb>`? Page-spanning
   entity tags may be undesirable for citation workflows.
2. **Collation anchors** — with **clean import**, inline `beg`/`end` anchors are
   stripped; without clean, should empty anchors be skipped in projection only,
   or also wrapped inside new NE tags?
3. **`<g>` / gaiji** — projection should use resolved Unicode (matching display
   text); map offsets back through the original `<g>` node.
4. **`choice` / `sic`** — follow `hiddenChoiceText.ts` rules for what enters the
   projection (same as disambiguation surface).
5. **Visual editor** — confirm TinyMCE body DOM matches XML DOM structure for
   milestone placement before relying on wrap apply in visual mode.

---

## Acceptance (phase B+C minimum)

Re-import or hand-build a file containing `《般舟三<lb …/>昧》` with **clean
import** and **strip lb unchecked**. Authority tag bomb suggests `般舟三昧` (or
the full work title if in packs) and apply produces a single tag spanning both
text nodes with `<lb>` preserved inside.

---

## Code touchpoints (expected)

- `packages/cwrc-leafwriter/src/autoTagging/anchor.ts` — projection index, compound boundaries
- `packages/cwrc-leafwriter/src/autoTagging/dictionary.ts` — projection scan mode
- `packages/cwrc-leafwriter/src/autoTagging/apply.ts` — `wrapProjectionRange`
- `packages/cwrc-leafwriter/src/autoTagging/dates.ts` — `offsetToRawRange` generalisation
- `packages/cwrc-leafwriter/src/autoTagging/llmParse.ts` — `locateInDoc`
- `packages/cwrc-leafwriter/src/autoTagging/purge.ts` — share `INFRASTRUCTURE_TAGS` list
