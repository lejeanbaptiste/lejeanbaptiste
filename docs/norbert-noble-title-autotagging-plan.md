# Norbert noble-title autotagging and person-context data

**Status:** Planning

This document records the agreed direction for bringing Norbert's contextual
person matching into the Norbert plugin. The goal is to preserve the useful
parts of Norbert's existing workflow—especially concatenated Chinese person
descriptions—without importing hypothetical combinations into the user's
entity database.

## Problem

Historical Chinese references often identify one person through a sequence of
components rather than through a simple personal name:

```text
合州刺史鄱陽王範
```

The sequence may contain:

- dynasty or court affiliation;
- an official post;
- a place of origin or fief;
- a noble rank or title;
- a personal name, style name, posthumous name, or temple name.

Norbert currently generates large sets of hypothetical strings from these
components with `nttg3()` and `persName_expansion`. These combinations are
valuable for matching and disambiguation, but they are not themselves persons
and must not pollute a user's entity database.

## Core separation

The system has three distinct layers:

### 1. Authority and matcher data

The plugin ships read-only, compiled data for matching and disambiguation.
This includes hypothetical noble-title/person combinations. It is not a
project entity store and is never modified merely because a string matched in
a document.

The existing `wiki-nt-links` asset is the foundation for the noble-title
portion of this layer.

### 2. Project entities

`entities.xml` stores confirmed project knowledge: persons and relationships
that the user has accepted, created, or explicitly imported. It already
persists nationality data, and it should collect confirmed contextual data
such as:

- nationality/dynasty/court;
- place of origin;
- noble titles and fiefs;
- official posts;
- alternate names and authority links.

Hypothetical combinations do not become entities. A confirmed document match
may contribute a relationship to an existing entity, subject to the normal
confirmation policy.

### 3. Document markup

The document records what occurs in the source and how the occurrence is
associated with a resolved person. It does not need to reproduce the entire
authority record.

For example:

```xml
<name type="personWrapper" key="person-456">
  <roleName>合州刺史</roleName>
  <nobleTitle>
    <placeName>鄱陽</placeName>
    <roleName>王</roleName>
  </nobleTitle>
  <persName>範</persName>
</name>
```

There is exactly one person key per `personWrapper`. The wrapper represents
one textual person mention; its children remain ontologically distinct.

## TEI extensions

LJB extends the TEI schemas with the following conventions.

### Sanmiao date components

Calendar components such as `dyn`, `ruler`, `era`, `year`, `month`, and `day`
are allowed inside `date`.

These children record what is explicitly present in the source. Resolution
attributes such as `era_id`, `ruler_id`, `jdn`, and `when` record table-based
interpretation. The distinction is necessary because Sanmiao must be able to
resolve and re-resolve dates, including dates whose full calendar context is
implied from tables rather than written in the source.

### `nobleTitle`

`nobleTitle` groups a title phrase while preserving its component semantics:

```xml
<nobleTitle>
  <placeName>鄱陽</placeName>
  <roleName>王</roleName>
</nobleTitle>
```

It is a document-level textual structure, not an authority entity and not a
database record by itself.

### `name type="personWrapper"`

`personWrapper` groups concatenated facts that jointly identify one person:

```xml
<name type="personWrapper" key="person-456">
  <roleName>合州刺史</roleName>
  <nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle>
  <persName>範</persName>
</name>
```

The wrapper provides association; the child elements provide ontology. The
wrapper should not flatten office, place, title, and personal name into one
`persName`.

## Required authority data

Before implementing the full noble-title autotagger, the plugin needs stable
local lookup data for:

| Domain | Required use |
|---|---|
| Persons and names | Resolve the personal-name component and alternate forms |
| Nationality/dynasty/court | Restrict candidates by historical polity and period |
| Places | Resolve origin places and fiefs |
| Noble titles | Match fief + rank combinations and link them to persons |
| Official posts | Resolve office strings and person–office relationships |
| Dates/ranges | Reject historically impossible person/title/office matches |

The data should be compiled into authority-pack records with stable authority
IDs, names, search strings, and minimal contextual metadata. The pack is used
for candidate generation and disambiguation; it is not edited by users.

Place-of-origin resolution follows the two-mode policy in
[placename-geo-disambiguation-planning.md](placename-geo-disambiguation-planning.md):
coherent nearby coordinate candidates may produce a coordinate place entity;
missing-coordinate candidates use ID mode; and any unresolved geographic
conflict causes all candidates to be imported as ID-mode places. This policy
must be settled before noble-title fiefs are persisted, since fiefs use the
same place entity model.

## Required entity-data model

The project entity model needs to represent confirmed relationships without
turning every textual occurrence into a duplicate entity. Conceptually:

```xml
<person xml:id="person-456">
  <persName>範</persName>
  <nationality ref="norbert:dynasty:…">梁</nationality>
  <origin ref="norbert:place:…">鄱陽</origin>
  <occupation ref="norbert:office:…">合州刺史</occupation>
  <nobleTitle ref="norbert:noble-title:…">
    <placeName ref="norbert:place:…">鄱陽</placeName>
    <roleName ref="norbert:rank:…">王</roleName>
  </nobleTitle>
</person>
```

For noble titles specifically, `entities.xml` should store the confirmed
relation on the person record, not a hypothetical person string. The title
should stay decomposed into the same components used in document markup:

- `placeName` for the fief or territorial component;
- `roleName` for the rank/title component;
- optional `ref` / `key` values pointing to the authoritative record for the
  confirmed title;
- source provenance on the stored relation, not just in the source document.

The exact existing `entities.xml` vocabulary and cardinalities must be checked
before implementation. The essential requirements are:

- one stable project person ID;
- repeatable relationships to places, offices, dynasties, and titles;
- authority references where available;
- provenance for the source document and confirmation decision;
- no automatic creation from an unresolved or hypothetical match.

## Implementation order

The work should proceed in this order:

1. settle the `entities.xml` storage shape for noble titles;
2. encode that shape in the TEI XML files;
3. update the relevant schemas to allow the new elements and attributes;
4. document the new behavior alongside the other TEI and Norbert changes;
5. only then wire the person and noble-title expander into the Norbert plugin.

That ordering keeps the storage model, source markup, schema, and plugin
behavior aligned instead of letting any one layer drift ahead of the others.

## Autotagging workflow

Once the data foundation is stable, Norbert can provide a post-processing
autotagging producer:

1. Run the ordinary date, authority, place, office, and person producers.
2. Read tagged component spans from the document.
3. Detect compatible contiguous sequences, including noble-title patterns.
4. Query the transient authority matcher index.
5. Use dynasty, place, office, title, date, and personal-name context to rank
   candidates.
6. Emit one compound suggestion for the complete person mention.
7. On acceptance, write the nested component markup and one
   `name[@type='personWrapper']`.
8. Attach the single resolved person key to the wrapper.
9. Offer confirmed relationships for persistence in `entities.xml`, without
   automatically creating hypothetical entities.

For `合州刺史鄱陽王範`, the intended result is:

```xml
<name type="personWrapper" key="person-456">
  <roleName>合州刺史</roleName>
  <nobleTitle>
    <placeName>鄱陽</placeName>
    <roleName>王</roleName>
  </nobleTitle>
  <persName>範</persName>
</name>
```

## Sequenced implementation plan

### Phase 1 — Authority contracts

- Define pack schemas for persons, dynasties, places, offices, and noble
  titles.
- Define place records with a display string, stable authority IDs, optional
  coordinates, and source provenance; authorities need not share one structure.
- Extend the Norbert compiled asset or add companion assets as needed.
- Preserve stable authority IDs and source provenance.
- Define normalized search strings and contextual fields.

### Phase 2 — Entity persistence

- Inspect the current `entities.xml` schema and entity writer.
- Add confirmed person relationships for nationality, origin, office, and
  noble title; origin and fief relationships point to the appropriate
  coordinate-mode or ID-mode place entity.
- Add authority references and provenance.
- Ensure imports and updates are idempotent.
- Ensure hypothetical matcher candidates never enter `entities.xml`.

### Phase 3 — Core compound-suggestion support

- Add a post-autotagging extension point, or an equivalent producer phase,
  that runs after ordinary component tagging.
- Support a suggestion whose final application creates nested markup and a
  wrapper in one undoable operation.
- Ensure schema containment and overlap handling work with nested
  `nobleTitle` and `personWrapper` elements.

### Phase 4 — Noble-title matcher

- Implement detection of compatible tagged spans.
- Match full and abbreviated noble-title combinations.
- Rank candidates using dynasty, office, place, title, date, and personal
  name.
- Emit unresolved candidates for review rather than inventing entities.

### Phase 5 — Confirmation and feedback

- On accepted matches, write one person key on the wrapper.
- Offer confirmed relationship updates to `entities.xml`.
- Use confirmed project data to improve later disambiguation.
- Keep the shipped authority asset immutable during document editing.

### Phase 6 — Norbert expander integration

- Expose the person and noble-title expander as a plugin-side matcher hook.
- Feed the transient `persName_expansion` / noble-title combinations into
  post-autotag suggestion generation.
- Keep hypothetical combinations out of `entities.xml`; only confirmed
  wrapper keys and confirmed relations should persist.
- Reuse the same compiled authority inputs for both tagging and
  disambiguation, so the plugin and the project entity store stay in sync.

## Design constraints

- One `personWrapper` contains one person ID at most.
- A wrapper is a textual association, not a new entity type.
- Child annotations remain semantically separate.
- Hypothetical combinations are matcher data, not entities.
- Source text and table-derived interpolation must remain distinguishable.
- Accepted changes must be undoable and idempotent.
- Authority IDs and project entity IDs must not be confused.
- Existing documents without the new wrapper markup must remain valid.

## Immediate next step

The immediate next task is Phase 1 plus an audit of the existing
`entities.xml` model. We should settle the authority record contracts and the
confirmed relationship representation before implementing the noble-title
autotagging producer.
