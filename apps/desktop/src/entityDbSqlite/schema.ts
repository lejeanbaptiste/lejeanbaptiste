/**
 * SQLite schema for the live CEDB/PEDB entity store.
 *
 * XML remains the interchange format during migration, but this schema is the
 * runtime authority. Keep migrations append-only: a database may be opened by
 * a later application version and upgraded exactly once per version.
 */

import type { DatabaseSync } from 'node:sqlite';

export const ENTITY_DB_SCHEMA_VERSION = 5;

const migration1 = `
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'place', 'work', 'office', 'org')),
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS entities_kind_idx ON entities(kind);
CREATE INDEX IF NOT EXISTS entities_updated_idx ON entities(updated_at);

CREATE TABLE IF NOT EXISTS people (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT,
  family_name TEXT,
  given_name TEXT
);

CREATE TABLE IF NOT EXISTS places (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT,
  latitude REAL,
  longitude REAL
);

CREATE TABLE IF NOT EXISTS works (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS offices (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS organizations (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS entity_names (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  name_type TEXT,
  language TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS entity_names_entity_idx ON entity_names(entity_id);
CREATE INDEX IF NOT EXISTS entity_names_text_idx ON entity_names(text COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS entity_names_active_idx ON entity_names(status, text COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS entity_authorities (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  authority_type TEXT NOT NULL,
  authority_value TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'authority' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (entity_id, authority_type, authority_value)
);

CREATE INDEX IF NOT EXISTS entity_authorities_lookup_idx
  ON entity_authorities(authority_type, authority_value, status);

CREATE TABLE IF NOT EXISTS entity_dates (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  date_kind TEXT NOT NULL,
  start_year INTEGER,
  end_year INTEGER,
  start_precision TEXT,
  end_precision TEXT,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS entity_dates_entity_idx ON entity_dates(entity_id, date_kind);

CREATE TABLE IF NOT EXISTS person_nationalities (
  id INTEGER PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(entity_id) ON DELETE CASCADE,
  nationality_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  reference TEXT,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS person_origins (
  id INTEGER PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(entity_id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  reference TEXT,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS person_titles (
  id INTEGER PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(entity_id) ON DELETE CASCADE,
  dynasty TEXT,
  place_name TEXT NOT NULL,
  role_name TEXT NOT NULL,
  posthumous_name TEXT,
  reference TEXT,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_authors (
  id INTEGER PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(entity_id) ON DELETE CASCADE,
  person_id TEXT REFERENCES people(entity_id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  reference TEXT,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_tombstones (
  id INTEGER PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  row_id INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (table_name, row_id)
);

CREATE TABLE IF NOT EXISTS entity_provenance (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  row_id INTEGER NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  recorded_at TEXT NOT NULL,
  UNIQUE (table_name, row_id)
);

CREATE TABLE IF NOT EXISTS central_mappings (
  project_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  central_entity_id TEXT NOT NULL,
  user_stable_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_entity_id, user_stable_id)
);

CREATE INDEX IF NOT EXISTS central_mappings_central_idx
  ON central_mappings(central_entity_id, user_stable_id);

CREATE TABLE IF NOT EXISTS sync_state (
  project_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  central_entity_id TEXT NOT NULL,
  central_revision INTEGER NOT NULL,
  project_revision INTEGER NOT NULL,
  central_hash TEXT NOT NULL,
  project_hash TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (project_entity_id, central_entity_id)
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id INTEGER PRIMARY KEY,
  project_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  central_entity_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  project_revision INTEGER NOT NULL,
  central_revision INTEGER NOT NULL,
  project_snapshot TEXT NOT NULL,
  central_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS sync_conflicts_open_idx
  ON sync_conflicts(status, project_entity_id, central_entity_id);
`;

const migration2 = `
CREATE TABLE IF NOT EXISTS database_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_metadata (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'xml' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS entity_metadata_lookup_idx ON entity_metadata(entity_id, key, status);

CREATE TABLE IF NOT EXISTS entity_xml_fragments (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  xml TEXT NOT NULL,
  UNIQUE (entity_id, ordinal)
);
`;

const migration3 = `
ALTER TABLE entity_names ADD COLUMN name_role TEXT NOT NULL DEFAULT 'variant';

ALTER TABLE entity_dates ADD COLUMN when_value TEXT;
ALTER TABLE entity_dates ADD COLUMN not_before TEXT;
ALTER TABLE entity_dates ADD COLUMN not_after TEXT;
ALTER TABLE entity_dates ADD COLUMN from_value TEXT;
ALTER TABLE entity_dates ADD COLUMN to_value TEXT;
ALTER TABLE entity_dates ADD COLUMN from_circa INTEGER NOT NULL DEFAULT 0 CHECK (from_circa IN (0, 1));
ALTER TABLE entity_dates ADD COLUMN to_circa INTEGER NOT NULL DEFAULT 0 CHECK (to_circa IN (0, 1));
ALTER TABLE entity_dates ADD COLUMN date_system TEXT NOT NULL DEFAULT 'gregorian';
ALTER TABLE entity_dates ADD COLUMN calendar_payload TEXT;
ALTER TABLE entity_dates ADD COLUMN raw_text TEXT;

CREATE TABLE IF NOT EXISTS authority_caches (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  authority_type TEXT NOT NULL,
  source TEXT,
  payload_json TEXT NOT NULL,
  retrieved_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  UNIQUE (entity_id, authority_type, source)
);

CREATE TABLE IF NOT EXISTS entity_decisions (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL,
  target_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  payload_json TEXT,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_relations (
  id INTEGER PRIMARY KEY,
  relation_type TEXT NOT NULL,
  subject_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  object_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  active TEXT,
  passive TEXT,
  symmetric INTEGER NOT NULL DEFAULT 0 CHECK (symmetric IN (0, 1)),
  reference TEXT,
  origin TEXT NOT NULL DEFAULT 'xml' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS entity_relations_subject_idx
  ON entity_relations(subject_entity_id, relation_type, status);

CREATE TABLE IF NOT EXISTS person_offices (
  id INTEGER PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(entity_id) ON DELETE CASCADE,
  office_id TEXT REFERENCES offices(entity_id) ON DELETE SET NULL,
  office_label TEXT NOT NULL,
  start_date_id INTEGER REFERENCES entity_dates(id) ON DELETE SET NULL,
  end_date_id INTEGER REFERENCES entity_dates(id) ON DELETE SET NULL,
  reference TEXT,
  origin TEXT NOT NULL DEFAULT 'xml' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS office_classifications (
  id INTEGER PRIMARY KEY,
  office_id TEXT NOT NULL REFERENCES offices(entity_id) ON DELETE CASCADE,
  classification_id TEXT NOT NULL,
  reference TEXT,
  label TEXT,
  origin TEXT NOT NULL DEFAULT 'xml' CHECK (origin IN ('user', 'authority', 'xml')),
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'withdrawn')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_positions (
  entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  list_kind TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_attributes (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  namespace TEXT,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  UNIQUE (entity_id, namespace, name)
);

CREATE TABLE IF NOT EXISTS entity_extensions (
  id INTEGER PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  namespace TEXT,
  element_name TEXT NOT NULL,
  xml TEXT NOT NULL,
  UNIQUE (entity_id, ordinal)
);
`;

const migration4 = `
ALTER TABLE person_titles ADD COLUMN place_reference TEXT;
ALTER TABLE person_titles ADD COLUMN role_reference TEXT;
ALTER TABLE person_titles ADD COLUMN posthumous_reference TEXT;
ALTER TABLE person_titles ADD COLUMN when_value TEXT;

ALTER TABLE person_nationalities ADD COLUMN source_ids_json TEXT;
ALTER TABLE person_origins ADD COLUMN name_type TEXT;
`;

const migration5 = `
ALTER TABLE entity_decisions ADD COLUMN target_refs TEXT;
`;

const migrations: Record<number, string> = {
  1: migration1,
  2: migration2,
  3: migration3,
  4: migration4,
  5: migration5,
};

export function applyEntityDbMigrations(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  const current = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
  if (current > ENTITY_DB_SCHEMA_VERSION) {
    throw new Error(
      `Entity database schema ${current} is newer than this application supports (${ENTITY_DB_SCHEMA_VERSION}).`,
    );
  }
  for (let version = current + 1; version <= ENTITY_DB_SCHEMA_VERSION; version += 1) {
    const sql = migrations[version];
    if (!sql) throw new Error(`Missing entity database migration ${version}.`);
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version};`);
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
  }
}
