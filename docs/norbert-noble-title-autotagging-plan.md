# Norbert noble-title autotagging and person-context data

**Status (2026-08-02):** **Shipped** — wrapper pack, concatenation, reviewed noble-title filtering, shared expander cache, idle warm-up, staged Norbert review, and live PEDB wrapper-key checks are wired into the authority-tagging flow. The reviewed filter is source-specific and exact-match only; the authority bundle now includes the generated policy pack.

## Reviewed noble-title filter

The authority-extraction review table
`authority extraction/reports/noble-title-authority-review.csv` is the curation
source. Its accepted rows are compiled into the `noble-title-filter` authority
pack. Deferred and rejected rows are not loaded as title rules.

At runtime Grognard loads this policy pack automatically when present. For every
authority candidate, an exact approved `persName`/`roleName` surface is removed
from generic name matching and replaced by the derived structural candidate:

```xml
<nobleTitle><placeName>海鹽</placeName><roleName>公主</roleName></nobleTitle>
```

Title candidates never mint person or office entities. The same filter is
applied to extra candidates supplied by project/central databases and imported
authority lists. Group & Clean uses the exact same reviewed candidates to
repair already-tagged title-shaped `persName`/`roleName` elements, preserving
an existing person key on a generated wrapper.

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

The Norbert SQL/export workflow must also extract the person-wrapper
combinations needed by the matcher. These exports should preserve the
component fields—nationality, origin or fief, office, noble-title parts, and
personal-name forms—rather than exporting only a flattened display string.
The flattened combinations can then be generated into the plugin-owned
matcher asset without becoming project entities.

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

Grognard extends the TEI schemas with the following conventions.

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

| Domain                    | Required use                                                       |
| ------------------------- | ------------------------------------------------------------------ |
| Persons and names         | Resolve the personal-name component and alternate forms            |
| Nationality/dynasty/court | Restrict candidates by historical polity and period                |
| Places                    | Resolve origin places and fiefs, but keep those relations distinct |
| Noble titles              | Match fief + rank combinations and link them to persons            |
| Official posts            | Resolve office strings and person–office relationships             |
| Dates/ranges              | Reject historically impossible person/title/office matches         |

The data should be compiled into authority-pack records with stable authority
IDs, names, search strings, and minimal contextual metadata. The pack is used
for candidate generation and disambiguation; it is not edited by users.

Place-of-origin resolution follows the two-mode policy in
[placename-geo-disambiguation-planning.md](placename-geo-disambiguation-planning.md):
coherent nearby coordinate candidates may produce a coordinate place entity;
missing-coordinate candidates use ID mode; and any unresolved geographic
conflict causes all candidates to be imported as ID-mode places. Fiefs use
the same place authority, but they are a different relation from origin and
must be stored separately.

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
    <persName type="posthumous" ref="norbert:posthumous:…">…</persName>
  </nobleTitle>
</person>
```

For noble titles specifically, `entities.xml` should store each confirmed
title combination as its own relation on the person record, not a hypothetical
person string and not a standalone noble-title entity. One person can have
multiple distinct noble-title relations over time, for example different
fiefs, different ranks, or separate posthumous titles. Each stored relation
should stay decomposed into the same components used in document markup:

- `placeName` for the fief or territorial component;
- `roleName` for the rank/title component;
- `persName type="posthumous"` or other title-part elements where the source requires it;
- optional `ref` / `key` values pointing to the authoritative record for the
  confirmed title;
- source provenance on the stored relation, not just in the source document.

Fief is not origin. The same place authority can support both, but the
relation type must distinguish whether the place is a homeland, a fief, or
something else. If a title string needs a posthumous-name component, the
stored and TEI-facing form should use `persName type="posthumous"` inside the
`nobleTitle`, not a separate custom element.

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

## Open discussion items

Before we wire the final Norbert plugin behavior, we still need to settle:

- how the noble-title spans should be tagged in the document flow, including
  the exact boundary rules for when a title begins and ends;
- how the person-name generator should assemble and rank candidate strings,
  especially where title, fief, posthumous name, and personal name all overlap.

The current Norbert rules are the baseline for both decisions. In particular,
nationality markers may be inserted temporarily as disambiguation context. A
nationality marker is retained only when it participates in a meaningful
concatenated person match; an isolated one-character nationality must not
survive merely because it was useful during candidate generation.

Standalone noble titles may remain tagged when they are genuinely standalone.
They should not be absorbed into a `personWrapper` when they are not followed
by, or otherwise joined to, a personal name or another meaningful person
context. When a noble title does participate in a recognized person sequence,
its fief and role components remain nested inside `nobleTitle`.

Generated combinations are transient matcher data. They must never appear as
project entities merely because they were generated or matched. Only a
resolved person occurrence, or a relationship explicitly confirmed by the
user, may affect `entities.xml`.

## Incremental name-generation and caching strategy

The generator should not rebuild every combination before every document
batch. It should maintain a derived, in-memory matcher cache keyed by the
relevant entity and authority-data revisions.

The intended behavior is:

1. Generate or load the complete cache at application startup when needed.
2. When a person or related authority record is ingested, generate only that
   person's combinations immediately.
3. Leave unchanged people untouched, using a per-person fingerprint of the
   inputs that affect generation: names, nationality/dynasty, origin, fiefs,
   roles, noble-title components, and relevant date ranges.
4. Invalidate and rebuild only affected people when entities are refreshed.
5. Provide an explicit full rebuild for migrations, schema changes, and
   troubleshooting.

The first implementation should make startup and entity-refresh generation
non-blocking and expose progress/cancellation if the work proves visible to
users. An optional idle-time sweep can be added later, but it should not be
necessary for correctness: the cache must already be correct after startup,
ingestion, or refresh.

The cache may be persisted as a plugin-owned derived artifact for fast
startup, provided that it is clearly separate from `entities.xml`, can be
discarded and regenerated, and is invalidated when its source revision or
generation algorithm changes.

## New implementation todo items

- Store `name type="personWrapper"` occurrences with exactly one resolved
  person key; integrate them into autotagging and disambiguation, but exclude
  wrappers from the entities-panel entity list.
- Add validation for person wrappers: exactly one person key, valid nested
  component structure, no hypothetical wrapper persisted as an entity, and
  preservation of the wrapper's single-person association through save,
  reload, and export.
- Preserve Norbert's temporary-nationality behavior and reject unresolved
  standalone nationality markers from final output.
- Define and test the boundary rules distinguishing standalone `nobleTitle`
  markup from title components inside a `personWrapper`.
- Implement incremental name-generation caching, including fingerprints,
  invalidation, derived-cache persistence, and a full-rebuild path.
- Export wrapper-ready combinations from Norbert SQL, including the separate
  `person_noble_titles` component fields and their person IDs.
- Run the wrapper candidate pass before ordinary component tagging, ordered by
  descending surface length; after component tagging, run a second
  concatenation pass to discover, validate, and intake newly formed wrapper
  candidates.

These belong in the Norbert plugin discussion because they affect UI behavior
and candidate generation, not just the stored authority data.

## Autotagging workflow

Once the data foundation is stable, Norbert can provide a post-processing
autotagging producer:

1. Run the person-wrapper producer first. It searches the longest generated
   person combinations before any shorter component producer claims their
   text.
2. Read and preserve the nested component spans selected for each wrapper.
3. Query the transient authority matcher index.
4. Use dynasty, place, office, title, date, and personal-name context to rank
   candidates.
5. Emit one compound suggestion for the complete person mention.
6. On acceptance, write the nested component markup and one
   `name[@type='personWrapper']`.
7. Attach the single resolved person key to the wrapper.
8. Offer confirmed relationships for persistence in `entities.xml`, without
   automatically creating hypothetical entities.

The wrapper pass must be ordered by descending matched span length, with
overlap handling that preserves the longest accepted wrapper. Only after this
pass should the ordinary person, noble-title, office, place, nationality, and
other component producers run on text not already claimed by a wrapper.

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

## Current implementation snapshot

As of July 26, 2026, the following pieces are in place:

- `entities.xml` stores repeatable `nobleTitle` relations on people, with each
  title decomposed into its parts and posthumous components represented as
  `persName type="posthumous"`.
- The Norbert plugin ships a bundled runtime asset,
  `data/wiki-nt-links.ndjson`, registered as the `norbert-wiki-nt` authority
  pack.
- That asset is compiled from the plugin’s wiki/Norbert review workflow, not
  from the live SQL dump.
- The current compiled asset contains 903 reviewable rows; more can be added
  later as the Wikipedia/Norbert title set is expanded.

That means the storage model is now stable enough to document and ship, while
the final runtime wiring still needs to connect the combined title pack into
the Norbert tagging/disambiguation path.

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
  coordinate-mode or ID-mode place entity, but remain distinct relation
  types.
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
- Allow multiple distinct noble-title relations per person.
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

The current implementation ships `wiki-nt-links.ndjson` as structured
AuthorityCandidate rows. Grognard expands the noble-title components at runtime,
keeps wrapper search strings separate from standalone-title strings, and
renders the latter as `nobleTitle`. The wrapper candidates participate in both
the initial longest-match authority pass and the post-component concatenation
pass. The manifest no longer advertises a separate unimplemented producer;
the authority pack is consumed by the existing Norbert tag-bomb pipeline.

## Design constraints

- One `personWrapper` contains one person ID at most.
- A wrapper is a textual association, not a new entity type.
- Child annotations remain semantically separate.
- Hypothetical combinations are matcher data, not entities.
- Source text and table-derived interpolation must remain distinguishable.
- Accepted changes must be undoable and idempotent.
- Authority IDs and project entity IDs must not be confused.
- Existing documents without the new wrapper markup must remain valid.

## Current implementation status

The authority contract, private Norbert SQL export, wrapper pack registration,
schema validation, and initial wrapper-first matching path are implemented.
The private SQL dump is used only as a local build input and is not recorded
in, or shipped by, any repository. The generated pack contains 2,392 wrapper
records and 9,486 wrapper search strings in the current local build.

The second-pass compound mechanism is now implemented as well. After ordinary
component tags have been applied, `runPersonWrapperConcatenation()` scans the
wrapper pack for concatenated spans and returns `add-compound` suggestions.
Applying one of these moves the existing sibling elements under
`<name type="personWrapper">`, preserving their ontology and attributes.
This is intentionally a separate pass because a wrapper that crosses existing
element boundaries cannot be inserted by the ordinary single-text-node tagger.

## Remaining next steps

The two core wrapper-resolution items are implemented. The live document scan
copies a single known PEDB person key between the wrapper and its identity
`persName`, and marks missing, conflicting, stale, or ambiguous cases as
unresolved. The wrapper is still contextual markup: hypothetical Norbert
candidates never become entities.

Remaining work is testing and polish: exercise the staged workflow in a
packaged build, verify the full noble-title relation data after save/reload,
and finish any validator-specific presentation for `roleName` and wrappers.

## Validation-panel follow-up

- `name[@type="personWrapper"]` is included as a person mention, without
  exposing it as a separate entity category.
- `roleName` mentions are included in the same panel for office and title
  review.
- With Norbert enabled, the review order is mandatory: `nobleTitle`, then
  `personWrapper`, then the user's category choice. Each completed stage is
  refreshed against the current document so accepted child tags leave the
  pending pool.
- Build the tag-type dropdown from the tag types represented by the current
  document scan, and clear a stale selection when that type disappears.

## Wrapper resolution policy

The inner untyped `persName` is the identity-bearing child of a
`personWrapper`; the wrapper is contextual association markup, not a person
entity. During a validation scan:

- If the inner person already has a key, copy that key to the wrapper.
- If the wrapper already has a key, copy it to the inner person.
- If neither is keyed and the local entity database has exactly one matching
  person, assign that key to both automatically.
- If there are zero or multiple local matches, leave both unresolved and add
  `cert="unknown"` to the wrapper. The panel displays a red instruction to
  disambiguate the person first; creating a new entity or manually linking the
  wrapper itself is disabled.
- If the two existing keys disagree, preserve the conflict, mark the wrapper
  unresolved, and require another person disambiguation.

Resolving a wrapper through the person candidate list uses the inner person's
surface when creating/updating the entity and writes the selected key to both
elements. It therefore cannot accidentally create an entity named with the
entire concatenated title string. The wrapper-pack records are cached across
review sessions and cleared whenever authority packs refresh; the local entity file remains the source of truth for automatic
resolution.

When a wrapper is resolved, the enabled plugin entity-data extractors receive
the wrapper and reconcile its confirmed assertions into the keyed person. The
Norbert extractor writes repeatable, provenance-bearing `nobleTitle` values,
including separate fief, role, and posthumous-name components. Assertions are
scoped to the source document and wrapper occurrence, so a later refresh can
withdraw XML-derived values without deleting user-authored values.

The apply pipeline now runs wrapper validation after every batch. A wrapper
with `cert="unknown"` is reported as pending rather than structurally invalid;
other missing keys, conflicting keys, malformed title children, or missing
person components are reported as validation errors. The ordinary TEI schema
therefore permits the explicit pending state, while the Grognard wrapper validator
still enforces the resolved state.
