# Entity database & the case for a "database viewer"

Status: planning (2026-07-07).
Companion to [authority-packs-planning.md](authority-packs-planning.md), [Auto-tagging-phases.md](Auto-tagging-phases.md).

This document describes the **current** entity database mechanism (`entities.xml` + `EntityStore`) and lays out how to extend it into a human-facing **database viewer** — a smaller, project-scoped analogue of DILA's person authority cards (see screenshot discussion, 2026-07-07 session) — without reviving the legacy CWRC entities panel.

---

## 1. Why this doc exists

The legacy CWRC-Writer "entities" system (`js/entities/entitiesManager.ts`, `annotationsManager.ts`, `panels/entities/DesktopEntitiesPanel.tsx`, per-type dialogs) is a UI-first abstraction: users fill a form, the manager owns identity state in memory, and `cwrc2xml.ts`/`xml2cwrc.ts` read that state as the source of truth during (de)serialization. It predates — and duplicates — the newer principle that **tagging and identity are separate phases** ([[autotagging_no_ids_at_tag_stage]] / [Auto-tagging-phases.md](Auto-tagging-phases.md) Phase 4a): tag first with no `@key`, resolve identity later.

That newer phase already produced its own, independent identity store: `autoTagging/entities.ts` + `autoTagging/entityStore.ts`. It is **not** wired to `cwrc2xml.ts` and does not shadow tag state — it is a TEI standoff file that mentions point into via `@key`. This is the right foundation for a viewer. The legacy panel is not; removing it is a separate, larger UI/serialization migration (see prior discussion) and out of scope here.

---

## 2. Current state: `entities.xml` + `EntityStore`

### 2.1 File shape

`entities.xml` is a TEI standoff document (`autoTagging/entities.ts`):

```xml
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <publicationStmt>
        <idno type="ljb-entity-database">‹uuid fingerprint›</idno>
      </publicationStmt>
    </fileDesc>
  </teiHeader>
  <standOff>
    <listPerson>
      <person xml:id="person-000001" resp="#ljb-autotag">
        <persName>王安石</persName>
        <idno type="wikidata">Q182524</idno>
        <note type="authority-cache" source="wikidata" resp="le-jean-baptiste" when="...">
          { …raw fetched payload, JSON string… }
        </note>
      </person>
    </listPerson>
    <listPlace/>
    <listOrg/>
    <listBibl/>
  </standOff>
</TEI>
```

- Four kinds: `person` / `place` / `org` / `work` (`ENTITY_KINDS`), each with a dedicated list, item element, name element, and `xml:id` prefix.
- Ids are **minted sequentially per kind** (`person-000001`, …), never derived from names — collision-safe (`nextEntityId`).
- Zero or more `<idno type="…">` authority links per entity (VIAF, Wikidata, DILA, CBDB, CHGIS, GeoNames — `AuthorityId.type` is free text, not an enum).
- One optional `<note type="authority-cache">` per addition, holding the **raw** fetched authority payload as a JSON string, tagged with source + timestamp. This is opaque per-source — no normalized schema (see §4).
- A document-level fingerprint `<idno type="ljb-entity-database">` (UUID) so a project can detect it's pointing at a different `entities.xml` than the one its tags were resolved against (`entityDatabaseCheck.ts`).

### 2.2 Storage: central vs. project mode

`EntityStoreMode` is `'central' | 'project'` (`entityStoreResolve.ts`):

- **project mode** (default): `‹projectRoot›/entities.xml`, one database per project.
- **central mode**: `‹centralFolder›/entities.xml`, shared across every project that opts in — this is the LJB-user-wide database the DILA-card discussion assumed.

Both are already implemented and switchable per project (`__ljbLspProject.entityStore` / `.entityDbFolder`). Nothing new needed here for a viewer — it reads whichever `entities.xml` is active.

Alongside the entity file, `EntityStore` also owns a project-local `.ljb/` folder: a decision log (`entity-decisions.jsonl`, append-only audit trail of disambiguation choices), an authority-response cache directory, an AI-suggestion cache directory, and a pending-disambiguation-queue file. These are infra, not viewer-facing, but the decision log is a natural source for "why was this resolved to this id" provenance in a viewer (§5).

### 2.3 What writes to it today

- Phase 4b disambiguation resolves a tagged mention to an entity: either `addEntity()` (mint a new record, optionally seeded from an authority search result and its `cache` payload) or links to an existing `xml:id`, then writes `@key="person-000001"` onto the mention tag in the *document* XML (not into `entities.xml`).
- `entityDatabaseCheck.ts` / `purgeEntityKeysInProject` handle the fingerprint-mismatch recovery path (strip stale `@key`s across the project if the linked database changed underneath the project).

### 2.4 What's missing for a viewer today

- **No read/query API** beyond `findEntity(doc, id)` (linear TreeWalker scan) and the raw DOM. No index by kind, by authority type, or by partial name; no cross-reference from an entity id back to which documents/spans mention it.
- **No normalized fields** for alternate names, dates, or freeform notes-with-citation — only a single `<persName>` (surface form used at creation) and the opaque `cache` blob. A DILA-style card needs alt names and dates as first-class, source-agnostic data, not something the UI has to know how to parse out of arbitrary VIAF vs. Wikidata JSON shapes.
- **No UI** at all — nothing renders `entities.xml`. The closest analogue in the codebase (`DesktopEntitiesPanel`) belongs to the legacy, unrelated system.

---

## 3. What a "database viewer" would be

A read-and-light-edit surface over `entities.xml`, scoped per active database (central or project), that:

1. Lists entities by kind, searchable/filterable by name, authority type, or "has no authority link yet."
2. Shows a card per entity — DILA-style — combining: canonical name, alternate names, dates (birth/death or floruit), authority links (clickable out to VIAF/Wikidata/etc.), and freeform notes with citations.
3. Optionally shows **backlinks**: which documents/spans in the project(s) currently carry `@key="‹this id›"` (requires a project-XML scan, not stored in `entities.xml` itself — see §5.3).
4. Lets a user hand-edit the normalized fields (alt names, dates, notes) without needing to understand TEI or open the raw file.

This is compatible with the existing architecture: it's a viewer *of* the standoff file the disambiguation phase already produces, not a new identity store, and not a revival of `entitiesManager`.

---

## 4. Schema gap: normalized fields vs. opaque cache

Today, everything beyond the primary name and authority ids lives in one opaque `note[type=authority-cache]` JSON blob per source. Two options:

| Approach | Pro | Con |
|---|---|---|
| **A. Viewer parses `cache` per source at render time** | No schema change; ship viewer today | Viewer must know every source's JSON shape (VIAF cluster XML-derived JSON ≠ Wikidata entity JSON ≠ CBDB row); breaks when a source's payload shape changes; can't hand-edit (it's a fetch snapshot, not authored data) |
| **B. Add normalized TEI elements to the entity item** (`<persName type="alt">`, `<birth>`/`<death>` or `<floruit>`, `<note>` with `@source`/citation text), written once at creation/edit time from whichever source, and kept independent of `cache` | Source-agnostic viewer; user-editable; matches DILA's separation of structured fields vs. cited notes | Schema addition to `entities.ts` (`addEntity`, a new `updateEntity`); migration path for entities already created under the old shape |

**Recommendation: B**, keeping `cache` as a "last raw snapshot from source X, for reference/re-sync" field only — never the thing the viewer renders directly. This mirrors the DILA card's own structure (structured 別名/生年/卒年 fields vs. cited 註解 notes) and keeps the viewer decoupled from every authority source's native shape.

Concretely, extend `NewEntity`/`addEntity` (and add `updateEntity`) with:
- `altNames?: string[]` → multiple `<persName type="alt">` (or `<placeName type="alt">` etc.)
- `dates?: { birth?: string; death?: string; floruit?: string }` → `<birth>`/`<death>`/`<floruit>` (ISO or fuzzy TEI `@notBefore`/`@notAfter` if precision is uncertain)
- `notes?: { text: string; source？: string }[]` → `<note resp="…">` per entry, distinct from the `authority-cache` note type

This is additive — existing `entities.xml` files with only `<persName>` + `<idno>` remain valid; new fields are optional children.

---

## 5. Phased plan

### Phase V0 — Query layer (no UI)

- Add an indexed read API over a parsed `entities.xml` Document: `listEntities(doc, kind?, filter?)`, `getEntity(doc, id)` (replace linear `findEntity` scan with a `Map` built once per load), `searchEntities(doc, query)`.
- Keep this in `autoTagging/entities.ts` or a new `autoTagging/entityQuery.ts` — pure functions over a `Document`, testable without Electron, same discipline as the rest of the module.

**Exit:** something can answer "give me all persons with a Wikidata link" without a UI.

### Phase V1 — Schema extension (normalized fields)

- Implement §4 option B: extend `NewEntity`, `addEntity`; add `updateEntity(doc, id, patch)`.
- No migration script needed (fields are optional/additive); old entities just show as sparse cards.

**Exit:** disambiguation phase (or a future manual "edit entity" action) can write alt names/dates/notes, not just name + idno.

### Phase V2 — Viewer UI (read-first)

- A panel/dialog (new component, not `DesktopEntitiesPanel`) listing entities by kind with search, rendering a card per entity from the Phase V0/V1 data — DILA-card-shaped: name, alt names, dates, authority links (as clickable out-links), notes.
- Read-only first: proves the query layer and card layout before adding edit affordances.
- Lives wherever the project's other side panels live in the current (non-legacy) UI shell — **not** wired through `entitiesManager`/`Writer`.

**Exit:** user can open "database" for the active project (or central store) and browse/search resolved entities.

### Phase V3 — Backlinks (documents that mention this entity)

- On demand (not stored/duplicated on the entity itself, to avoid a second sync problem): scan project XML files for `@key="‹id›"` and show the hit list/snippets in the card. Same scan shape as `purgeEntityKeysInProject` already uses to walk project files.
- For central-mode databases shared across projects, this needs a bit more thought — "which project(s)" the backlink search covers should probably default to the currently open project only, not every project that ever pointed at the central store.

**Exit:** card answers "where does this person appear," not just "who are they."

### Phase V4 — Inline editing

- Add edit affordances to the V2 cards backed by `updateEntity` (V1). Include provenance display (`resp`, and optionally the matching entries from `entity-decisions.jsonl` — "resolved from mention 'X' in file Y on date Z") so users can judge trust like DILA's 出處 citations.

**Exit:** viewer is a genuine authoring surface for the entity database, not read-only.

### Explicitly out of scope here

- Reviving/repurposing `entitiesManager`/`annotationsManager` or the legacy dialogs.
- Cross-project backlink aggregation for central-mode databases (defer until someone actually runs multi-project central mode).
- Automatic re-sync of `cache` when an upstream authority record changes (separate "refresh" feature, not viewer core).

---

## 6. Relationship to existing docs

| Document | Role |
|---|---|
| [authority-packs-planning.md](authority-packs-planning.md) | Where authority candidates (name/id/dates) come from *before* disambiguation; `AuthorityCandidate.metadata` is a plausible source for V1's normalized dates/alt-names when an entity is minted from a pack hit |
| [Auto-tagging-phases.md](Auto-tagging-phases.md) | Phase 4a/4b: tag-then-disambiguate discipline this viewer must not violate |
| **This doc** | Current `entities.xml`/`EntityStore` shape + path to a DILA-style database viewer |

---

## 7. One-line summary

`entities.xml` already is the right kind of store — TEI standoff, tag-only mentions, central/project modes. What's missing is a query layer, a few normalized fields (alt names, dates, notes) alongside the opaque authority-cache blob, and a UI to browse it — not a new identity model, and not the legacy entities panel.
