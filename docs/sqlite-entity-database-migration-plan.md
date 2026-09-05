# SQLite entity database migration plan

**Status (2026-08-02):** **Shipped for the current beta.** SQLite is the live
store for panel/Bridge/sync paths, and runtime XML soft-fallbacks have been
removed. This document is now architectural record and future reference, not
an active beta-work plan.

**Decision:** SQLite becomes the authoritative storage format for the Central
Entity Database (CEDB) and Project Entity Databases (PEDBs). The existing XML
entity databases are imported once and retained as an export, backup, and
interoperability format. They are no longer the live operational store.

This plan supersedes the XML-focused synchronization design in
[`dual-entity-database-planning.md`](dual-entity-database-planning.md). The
corpus remains TEI/XML: document mentions continue to use `@key` values that
refer to project entity IDs.

### Implementation status

The SQLite foundation and several runtime slices are implemented in
`apps/desktop/src/entityDbSqlite/`:

- `schema.ts` provides the versioned SQLite schema and migration runner.
- `repository.ts` provides the initial typed repository and transaction layer.
- `repository.test.ts` verifies subtype creation, names, revisions, tombstones,
  rollback, and SQLite integrity checks.
- `xmlCodec.ts` imports legacy TEI entity XML and exports deterministic TEI XML,
  preserving unsupported child elements as XML fragments during the transition,
  and reports duplicate IDs and unresolved relation references.
- `xmlCodec.test.ts` verifies import and export/re-import against the repository
  fixture database.
- SQLite typed IPC now exposes description updates; user/work dates; nationality
  and origin adds; noble-title add/update; work-author replacement; authority
  attach/decouple; assertion validate/reject/remove; date/description
  acceptance; primary-name rename; and romanized-name updates. These operations
  use main-process transactions.
- Database-panel name creation, name-type/language changes, and deletion use
  SQLite for migrated databases, including family and given names. Those sync
  into both `entity_names` and `people.family_name` / `people.given_name`. User
  names are removed, authority names are rejected and tombstoned, and the next
  active name is promoted. XML remains the fallback for databases without
  SQLite.
- Database-panel description save, birth/death and work dates, nationality and
  origin add/remove, noble titles, work authors, authority attach/detach, and
  assertion validate/reject/remove use SQLite when the migrated database is
  present. XML remains the fallback otherwise.
- The panel now re-reads the changed entity through SQLite and updates the open
  edit state in place after direct field mutations, applying the available
  fields, titles, authors, and assertions instead of closing the dialog
  (except the full Save action, which still closes).
- The SQLite detail read now returns a typed panel snapshot with active and
  inactive names, authorities, dates, people fields, nationalities, origins,
  office affiliations (as `affiliation` assertions), roles, noble titles, work
  authors, description metadata rows, and provenance-bearing assertions.
  Arbitrary XML extension fragments remain storage-only (no panel UI).
- The database panel consumes this snapshot for list rows and the edit dialog,
  including role validate/reject against SQLite affiliation assertion keys and
  rejected role rows.
- Database fingerprint checks now read `database_metadata.database_id`
  directly from SQLite when the migrated database is present; they no longer
  export and parse the whole entity database merely to compare UUIDs.
- Project orphan scans now obtain the active PEDB ID set and fingerprint from
  SQLite when available; corpus XML is still parsed only to inspect corpus
  mentions, not to reconstruct the entity database.
- Background entity indexing now reads SQLite panel snapshots directly when a
  migrated database is present; it no longer exports the database to XML just
  to rebuild the index cache. The legacy XML branch remains for pre-migration
  databases.
- The database panel's initial entity list now reads SQLite panel snapshots
  directly for migrated databases. Duplicate-authority detection, CBDB
  concordance apply/reject/conflict surfacing, rejected-concordance panel
  snapshots, and merge-docket counts now run against SQLite for migrated
  databases (with XML fallback when no sibling `.sqlite` is present). The
  schema preserves decision target references, and duplicate detection
  applies preserved `duplicate-ok` groups. Panel "mark intentional" writes
  those groups directly to SQLite. A one-time sibling-XML backfill restores
  `target_refs` (and inserts missing decision rows) for databases whose
  earlier import dropped them; it runs automatically before duplicate
  detection and records completion in `database_metadata`.
- Desktop packaging now preserves Node's built-in `node:sqlite` runtime load;
  a build-time rewrite had incorrectly produced `require('sqlite')`, causing
  the main process to fail before startup.
- The focused repository/read-service tests and desktop TypeScript check pass.
- Pending central-order remaps (merge/delete survivors → PEDB `grognard-central`
  mappings) use SQLite `central_mappings` when the project database is
  migrated; order JSONL and applied-id cursors remain file-based.
- Synchronized mirror steady-state sync converges already-linked CEDB/PEDB
  pairs via SQLite content hashes and body replace. Catch-up for _unlinked_
  PEDB entities is an explicit SQLite worker job (`bulkBridgeImportSqlite` +
  BulkSyncIndicator), started only after user confirm — not on every reload.
- Authority backfill/refresh ("Backfill from authorities" / Refresh) writes
  typed SQLite patches for migrated databases: names, family/given/romanized,
  source-keyed dates, nationalities, origins, offices, Norbert noble titles,
  authority-cache payloads, Wikidata person→works, and work details. Rejected
  tombstones are not resurrected. After a successful SQLite backfill on the
  project database, CBDB person-concordance is re-applied so newly attached
  CBDB ids pick up merged-from links in the same action.
- Synchronized mirror _content_ sync (hash, upload, download, conflict) uses
  per-entity SQLite content hashes and body replace when both databases are
  migrated; it no longer full-export/re-import on the happy path. Central
  mappings and entity ids are preserved. Checkpoint JSON remains file-based.
- Bridge inbox classification and merge-docket display/resolve use SQLite panel
  summaries and `sqliteMerge` / `sqliteSoftDelete` (SQLite required). Pending
  suggestion filters take an id set rather than a DOM document.
- Disambiguation (panel + authority prefetch) loads PEDB/CEDB surface matches
  via SQLite name search + linked `central_mappings` ids when migrated; it no
  longer full-exports both databases on every mention-group review.
- **Wordprocessor integration (reads):** the Word/plugin HTTPS API
  (`apps/commons/src-server/routes/pluginEntities.ts`) serves status/search/
  get-by-id from sibling `entities.sqlite` only (no XML fallback). The add-in
  in `/Users/daniel/Code/leJeanBaptiste/wordprocessor/` stays a thin client;
  entity edits remain in Grognard.
- **Wordprocessor writes:** Word content-control insertion, reflow, formatting,
  and "Sync with Grognard" are already separate Office-document writes; they use
  SQLite-backed plugin reads and never write entity XML.
- Single-field edits in the database sidebar re-read and patch only the
  changed SQLite entity row. Full list reloads are reserved for bulk jobs,
  merge/delete remaps, and external database changes.

**Live verification** of the real CEDB/PEDB (restart, tombstone persistence,
synchronization, no-resurrection) is done for this installation. Ordinary
runtime entity reads and writes now require a migrated `entities.sqlite`
(fail loud / `unavailable` — no DOM `loadEntities`/`saveEntities` soft-gates
on the paths above). New folders from `createEntityDatabase` mint both
`entities.xml` (interchange scaffold) and sibling `entities.sqlite`.
**Remaining beta verification:** run
[entity-sync-manual-test-plan.md](entity-sync-manual-test-plan.md) in a
packaged build. Broader migration automation and multi-machine offline-sync
research are future work, not current release requirements.

### Recently implemented

- After authority pack install/update (lifecycle enable/update, onboarding,
  and manual pack install), CBDB person-concordance is re-applied to the
  open project PEDB via `refreshCbdbConcordanceAfterPackLifecycle` without
  waiting for Database panel reload. Panel reload and post-backfill apply
  remain as safety nets; a short debounce avoids double-cost when reload
  follows immediately.
- Extracted-data ingest from `scanMentions` / `resolveMention` writes
  Norbert wrapper facts (nationality, origin, office, noble title) into
  SQLite with `origin=xml` and `xml:<doc>#personWrapper:<n>` sources via
  `reconcileXmlExtractedData` / `sqliteEntityExtraction.ts`. Refresh adds
  new assertions, removes vanished unvalidated XML rows, and leaves
  user/rejected values alone. Live `saveEntities` is not used.
- DOM `promoteToCentral` / `resolveEntityInDocument` helpers deleted after
  unit tests were rewritten onto SQLite fixtures (`promoteToCentralSqlite`,
  `mintOrLinkEntitySqlite`); Wikidata enrich paths are fetch-only.
- Achievements entity counts prefer sibling `entities.sqlite`
  (`entitySqlite:countEntities`); XML is last-resort for unmigrated folders.

Pre-Step 3 schema coverage now also includes:

- Full date lexical fields, `notBefore`, `notAfter`, `from_circa`, `to_circa`,
  date systems, calendar payloads, and `fl.` date kinds.
- Name roles including primary, family, given, courtesy, posthumous, and
  variant.
- Authority caches, duplicate/concordance decisions, office affiliations,
  office classifications, hierarchy relations, entity positions, arbitrary
  entity attributes, and typed XML extensions.
- Imported provenance and tombstone audit rows.

The live application now uses the sibling SQLite file as the runtime authority
when present. The existing DOM-facing editor API is retained as a compatibility
boundary: it loads an exported view from SQLite and persists edits back into
SQLite. XML remains for one-time compatibility and explicit interchange.

## Goals

- Make a single entity mutation transactional and fast.
- Stop parsing, serializing, and re-indexing the entire entity database for
  every name, title, date, or tombstone change.
- Keep CEDB canonical for synchronized projects.
- Keep PEDB as a synchronized project mirror when synchronization is enabled.
- Preserve stable IDs, provenance, authority data, tombstones, and corpus keys.
- Preserve XML import/export for TEI interoperability and recovery.
- Keep renderer code independent of SQLite file access.

## Non-goals

- Moving corpus TEI files from XML to SQLite.
- Introducing a hosted database or server-side collaboration service.
- Maintaining live XML and SQLite databases as equal authorities indefinitely.
- Automatically merging conflicting edits from two machines without a clear
  resolution record.

## Domain model

People, places, works, offices, and organizations have different data models.
They should not be represented as one large table full of nullable,
type-specific columns.

Use a small shared identity registry plus separate domain tables:

```text
entities              -- identity and lifecycle only
├── people
├── places
├── works
├── offices
└── organizations

shared value tables
├── entity_names
├── entity_authorities
├── entity_provenance
├── entity_tombstones
└── entity_revisions

typed relationship/assertion tables
├── person_nationalities
├── person_origins
├── person_titles
├── work_authors
└── entity_dates
```

The registry is not a replacement for the domain tables. It provides one stable
foreign-key target for shared features such as names, authorities, provenance,
tombstones, synchronization, and corpus-facing identity.

## Proposed schema

The exact column types and indexes will be finalized during implementation,
but the ownership boundaries are fixed here.

### Identity registry

```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'place', 'work', 'office', 'org')),
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);
```

`entities.id` remains the ID used by corpus `@key` values for project entities.
Existing IDs must be preserved during migration; no bulk ID rewrite is allowed.

### Domain tables

Each domain table uses the registry ID as both primary key and foreign key:

```sql
CREATE TABLE people (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT,
  family_name TEXT,
  given_name TEXT
);

CREATE TABLE places (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT,
  latitude REAL,
  longitude REAL
);

CREATE TABLE works (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT
);

CREATE TABLE offices (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT
);

CREATE TABLE organizations (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT
);
```

Additional domain-specific columns should be added to the relevant subtype
table, not to `entities`.

### Names and authorities

```sql
CREATE TABLE entity_names (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  name_type TEXT,
  language TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'user',
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE entity_authorities (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  authority_type TEXT NOT NULL,
  authority_value TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'authority',
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE (entity_id, authority_type, authority_value)
);
```

Authority badges, validation, rejection, and tombstoning operate on individual
rows rather than regenerating an entity from authority data.

### Provenance and tombstones

Every imported or user-created repeatable value must retain its provenance:

- `origin`: `user`, `authority`, or `xml`.
- `source`: stable source key.
- `status`: `active`, `rejected`, or `withdrawn`.

Deleted values are tombstoned rather than physically removed when future
authority refreshes must not recreate them. The UI may hide inactive rows, but
the database retains them for audit and synchronization.

### Typed relationships

Nationalities are not automatically top-level entities. A nationality that is
just an assertion is stored as a typed relationship, for example
`person_nationalities`. If a nationality is itself a historical state or place
with an independent identity, it can reference `entities(id)`.

The same rule applies to origins, noble titles, authors, roles, and dates:
store them as typed relationships or assertions unless they need independent
entity identity.

## Database locations

- CEDB SQLite file: beside the existing CEDB `entities.xml`.
- PEDB SQLite file: beside the project’s existing PEDB `entities.xml`.
- Per-database metadata, migration markers, checkpoints, and conflict records:
  adjacent `.grognard/` metadata.

For the current installation the filename is fixed as `entities.sqlite`; no
general relocation or database-discovery framework is required.

SQLite must be opened and written by the Electron main process. Renderer IPC
methods should expose typed operations rather than generic arbitrary SQL or
arbitrary file writes.

Recommended SQLite settings:

- Foreign keys enabled.
- WAL journal mode.
- Busy timeout configured.
- Explicit transactions for every mutation.
- Schema version stored in `PRAGMA user_version` or a migrations table.
- No renderer-side database connection.

## CEDB/PEDB synchronization

### Synchronized projects

CEDB is canonical. PEDB is a mirror containing the project’s linked entities.

Each entity mutation increments its revision. Synchronization compares the
last common revision/hash:

| CEDB      | PEDB                | Result                     |
| --------- | ------------------- | -------------------------- |
| unchanged | unchanged           | no action                  |
| changed   | unchanged           | copy CEDB to PEDB          |
| unchanged | changed             | upload PEDB change to CEDB |
| changed   | changed identically | converge without conflict  |
| changed   | changed differently | create explicit conflict   |

Changes must be transactional. A tombstone is a normal versioned change and
must propagate exactly like an active value.

The project UI exposes the CEDB view only while synchronized. PEDB remains an
implementation mirror, not a second database for the user to edit manually.

### Unsynchronized projects

Unsynchronized projects retain explicit Link, Promote, Absorb, and manual
reconciliation workflows. They do not silently inherit the CEDB canonical
policy.

### Multi-machine behavior

The synchronization checkpoint belongs to the project and is portable. A
second laptop can upload a PEDB-only offline change if CEDB has not changed.
When both copies changed, the conflict is stored and shown to the user; neither
side is silently discarded.

## Application architecture

### Main-process repository

Create a repository layer in the desktop application responsible for:

- Opening and closing SQLite databases.
- Running schema migrations.
- Executing typed reads and writes.
- Running transactions.
- Returning entity summaries and detail records.
- Performing synchronization.
- Importing and exporting XML.

The existing entity operation functions should gradually call this repository
instead of manipulating XML DOM documents.

### Renderer IPC

Expose focused operations such as:

- `entity:list`
- `entity:search`
- `entity:get`
- `entity:update`
- `entity:add-name`
- `entity:tombstone-name`
- `entity:update-title`
- `entity:update-date`
- `entity:sync`
- `entity:export-xml`

IPC results should include the affected entity revision and updated summary so
the sidebar can replace one row without reloading the full database.

### UI refresh policy

- Ordinary single-entity mutation: update the affected row immediately after
  the transaction returns.
- Background synchronization: refresh affected entities when downloaded data
  arrives.
- Initial project open: load/index the database.
- External database change: refresh the relevant query or list.
- Merge, absorb, bulk import, or schema migration: perform an explicit broader
  refresh.

## XML migration and compatibility

### Importer

The importer must preserve:

- Entity IDs and kinds.
- Primary and alternative names.
- Name types and languages.
- Authority IDs and authority sources.
- Dates, places of origin, nationalities, roles, noble titles, and authors.
- User/authority/XML provenance.
- Rejected and withdrawn values.
- Tombstones.
- CEDB mappings and database identifiers.

Import must be idempotent and produce a validation report for duplicate IDs,
unsupported structures, malformed values, and unresolved references.

### Exporter

The exporter must produce deterministic XML for:

- User backups.
- TEI interoperability.
- Legacy tooling.
- Recovery and debugging.

SQLite remains authoritative. Exported XML must not be automatically treated as
newer than SQLite merely because it exists beside the database.

## Cutover strategy

This is an immediate architectural cutover, but it still needs a controlled
data migration:

1. Freeze new XML entity features.
2. Add the SQLite schema and repository.
3. Back up existing CEDB and PEDB XML files.
4. Import each database into SQLite.
5. Compare entity counts, IDs, names, authorities, and tombstones.
6. Run importer/exporter round-trip tests.
7. Mark the migration complete for that database.
8. Switch all normal reads and writes to SQLite.
9. Keep XML export and legacy import available for recovery.
10. Remove live XML synchronization and normal XML DOM mutation paths.

There should be no long-term dual-write mode. Writing both formats on every
mutation would create two authorities and reproduce the current resurrection
and stale-path problems.

## Implementation phases

### Phase 1 — Schema and repository

- Add SQLite dependency and main-process connection management.
- Add migrations and schema versioning.
- Implement identity and subtype tables.
- Implement names, authorities, provenance, tombstones, and revisions.
- Add repository tests with an in-memory database.

### Phase 2 — XML importer/exporter

- [x] Implement complete XML-to-SQLite import.
- [x] Implement deterministic SQLite-to-XML export.
- [x] Test every supported entity kind and repeatable field.
- [x] Produce migration diagnostics for duplicate IDs and unresolved relation
      references.
- [x] Migrate and spot-check the real CEDB at
      `/Users/daniel/ShareDocs/@Home/ljb_test_root/entities.xml`.
- [x] Verify real-database export/import round-trip counts and SQLite
      integrity.

### Phase 3 — Read path (next)

- Replace sidebar list and search reads.
- Replace entity detail reads.
- [x] Replace disambiguation and authority candidate reads (surface search +
      linked-central filter via SQLite; tag-bomb already used candidate records).
- Add query indexes and measure performance.

The focused single-user implementation has begun this phase: lookup, entity
load, entity save, and the background index path use SQLite when the sibling
database exists.

### Phase 4 — Mutation path

- [x] Replace name edits and tombstones.
- [x] Replace dates, descriptions, titles, origins, nationalities, authors, and
      authorities in the database panel (SQLite when migrated; XML fallback
      otherwise). Family/given-name panel edits use `people` scalars plus
      `entity_names`.
- [x] Return updated summaries from IPC / refresh the open edit row after
      ordinary field mutations.
- [ ] Remove full reloads after ordinary edits where a single-row list patch is
      enough.

### Phase 5 — Synchronization

- Implement CEDB/PEDB mappings in SQLite.
- Implement revisions and three-way synchronization.
- Implement conflict records and resolution UI.
- Test offline second-laptop scenarios.

### Phase 6 — Migration and cutover

- Add first-run migration detection.
- Back up XML before conversion.
- Import real project and central databases.
- Validate against known entity counts and spot checks.
- Switch production reads/writes to SQLite.

For the current single-user installation, migration is a one-time operation:
the CEDB and the one PEDB have already been imported and spot-checked. Future
general-purpose migration automation is explicitly deferred.

### Phase 7 — Cleanup

- **Slice 1 (done):** kill remaining live DOM write/soft-read paths
  (AttributesPanel name-type, `scanMentions` persist, lookup services,
  tag-bomb / short-form / group-and-clean, auto-tag pack counts, entity DB
  fingerprint/orphan sweep, order replay). Fail loud without SQLite.
- **Slice 2 (done):** gate `EntityStore.saveEntities` behind
  `allowSqliteFullReimport`; delete orphaned DOM helpers
  (`adoptFromCentral`, `ensureDatabaseLinked`, dead session/office wrappers);
  SQLite-aware external-change watch and order fingerprinting; document
  remaining DOM promote/resolve as test/reference only.
- Retain XML compatibility tools and documentation (`reimport-entity-sqlite`,
  xmlCodec, optional further DOM-helper deletion after test rewrite).
- Update existing planning documents to point here as the authoritative plan.

## Testing and acceptance criteria

### Data integrity

- All existing entity IDs survive migration unchanged.
- Every XML entity has exactly one matching SQLite registry/domain record.
- Names, authority IDs, provenance, and tombstones round-trip correctly.
- Corpus `@key` values continue resolving to project entity IDs.
- No rejected or tombstoned value is silently reactivated.

### Synchronization

- Central-only changes propagate to PEDB.
- PEDB-only offline changes upload to CEDB.
- Identical changes converge without conflict.
- Simultaneous different changes create visible conflicts.
- Deletions remain tombstones across synchronization.
- Synchronized UI never exposes PEDB as an alternate editable database.

### Performance

- Single name mutation does not parse or index all entities in the renderer.
- Single-row mutation is transactional and normally completes below 100 ms at
  the UI layer.
- Search uses SQLite indexes.
- A 33,000+ entity database remains responsive during ordinary editing.
- Background sync never blocks a save button or editor interaction.

### Recovery

- XML backups are created before migration.
- A failed migration leaves the original XML untouched.
- SQLite integrity checks run after import.
- Exported XML can reconstruct a usable SQLite database.
- Schema migrations are tested from every supported prior version.

## Open implementation questions

These do not change the architecture, but must be resolved during Phase 1:

- Which SQLite Node binding is already best supported by the desktop build.
- Exact filenames and `.grognard/` placement for CEDB and PEDB databases.
- Whether authority-cache payloads remain JSON blobs or receive typed tables.
- Whether conflict versions are stored as full row snapshots or change sets.
- How external SQLite file changes are detected and debounced.

None of these questions require returning to XML as the live database.
