# Grognard TEI extensions for historical Chinese texts

**Status:** Implemented in the generated TEI schemas (2026-07).

Grognard adds a small number of elements and conventions to TEI for information
that is important to historical Chinese tagging but is not fully represented
by the stock TEI content models. These are Grognard extensions, not replacements
for TEI semantics.

## Calendar structure inside `date`

Sanmiao treats a historical date as a calendar expression, not merely as a
string that can be converted once into a modern date. The text may explicitly
name a dynasty, ruler, era, year, month, day, sexagenary cycle, or related
calendar component. Those components are therefore retained as children of
`date`:

```xml
<date resp="#grognard-sanmiao">
  <dyn>魏</dyn><ruler>明帝</ruler><era>太和</era><year>十八年</year><month>二月</month>
</date>
```

The child elements record what is actually present in the source. Resolution
attributes such as `era_id`, `ruler_id`, `jdn`, and `when` record the result of
looking that expression up in Sanmiao's tables. They are deliberately kept
separate: a table may supply implied or interpolated calendar information,
but that information must not be mistaken for words occurring in the text.

This distinction supports both initial resolution and later re-resolution
when tables, calendar assumptions, or project settings change. In general,
parse children may be written when a date is tagged; resolution attributes
should be written only after a candidate has been selected or uniquely
resolved. See [the Sanmiao schema documentation](sanmiao-dates-schema.md) for
the complete element and attribute lists.

## `nobleTitle`

`nobleTitle` groups the title portion of a historical Chinese person mention
while retaining its internal components. It is used for a fief/place followed
by a rank or title, rather than treating the entire phrase as one place or
one office:

```xml
<nobleTitle>
  <placeName>鄱陽</placeName>
  <roleName>王</roleName>
</nobleTitle>
```

The plugin may use a shipped, transient index containing hypothetical
combinations generated from Norbert and Wikidata. Those combinations are
matcher candidates, not entity records. Only a combination that occurs in
the document is materialized as markup, and only a resolved person receives a
`key` or authority `ref`.

When a title string needs a posthumous-name component, use `persName` with
`type="posthumous"` inside the `nobleTitle`. The entity store may keep
several separate `nobleTitle` records for the same person.

## `name type="personWrapper"`

Chinese historical person references commonly concatenate several facts:
office, noble title, fief, place of origin, personal name, posthumous name,
and other identifying names. These facts belong to one person, but they are
not ontologically the same kind of name. `name[@type='personWrapper']` groups
the spans that jointly identify one textual person mention without flattening
their individual semantics:

```xml
<name type="personWrapper" key="norbert:person:456">
  <roleName>合州刺史</roleName>
  <nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle>
  <persName>範</persName>
</name>
```

The wrapper is an inline association, not a new hypothetical person and not
a replacement for the project's entity database. Its `key` points to the
resolved person contained by the mention; `ref` may additionally point to an
external authority such as Wikidata. Separate mentions of the same person
share the key rather than being merged structurally.

In the entity database, the same person may carry multiple repeatable
`<nobleTitle>` records, each with its own provenance and component parts.
That keeps "Lord of B" and "Prince of A" distinct instead of flattening them
into one title bucket.

## Office entities

Disambiguated offices are a fifth Grognard entity kind, while remaining within TEI
vocabulary. They serialize as `org[@type='office']` in a dedicated
`listOrg[@type='offices']`:

```xml
<listOrg type="offices">
  <org xml:id="office-…" type="office">
    <orgName>吏部</orgName>
    <idno type="CBDB">123</idno>
    <idno type="Norbert">456</idno>
    <state type="office-classification" ref="cbdb:office-type:060302"/>
  </org>
</listOrg>
```

Corpus mentions continue to use `roleName key="office-…"`. The application
kind and corpus tag are intentionally separate.

Office hierarchy is stored in `listRelation[@type='office-hierarchy']`.
CBDB category membership remains in the downloaded authority pack and is
referenced from the office entity. Norbert parent-child observations use
`relation[@name='parentOf']`; `@resp`, `@ana`, `@cert`, and `@corresp` retain
their source, inference rule, certainty, and source row ids.

```xml
<listRelation type="office-hierarchy">
  <relation name="parentOf"
    active="#office-parent" passive="#office-child"
    resp="#norbert" ana="office-concatenation" cert="low"
    corresp="urn:grognard:authority:norbert:1 urn:grognard:authority:norbert:2"/>
</listRelation>
```

These relations describe accumulated evidence, not a complete snapshot of a
dynasty's bureaucracy. Appointment assertions are currently retained inside
the selected person's `authority-cache` metadata for disambiguation and future
entity modeling; dates and biographical order are intentionally not imported.
Person-wrapper modeling remains a separate layer.

## Schema implementation

The desktop schema merge adds `nobleTitle` and `name[@type='personWrapper']`
to TEI phrase content and permits their component elements. The generated
schema remains a flattened project-local schema; the pristine upstream TEI
schema is preserved separately so the extension can be regenerated when the
TEI catalog or Grognard extension changes. The merge version is bumped whenever
these generated definitions change.
