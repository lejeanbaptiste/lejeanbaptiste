-- Rebuild central_entities as WITHOUT ROWID: the composite primary key becomes
-- the table b-tree itself, so an insert writes one fewer index row (~⅓ less
-- write amplification). Matters for the first full seed of a large authority
-- file against D1's free-tier write cap.
--
-- Destructive: drops the owner's central rows. Re-seed afterwards, either via
-- the client (Sync now) or apps/desktop/scripts/generate-entity-sync-seed.mjs
-- for a large first load. The client re-pushes anything not on the server.

DROP INDEX IF EXISTS central_entities_pull;
DROP TABLE IF EXISTS central_entities;

CREATE TABLE central_entities (
  central_id   TEXT NOT NULL,
  owner_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('person', 'place', 'work', 'office', 'org')),
  revision     INTEGER NOT NULL,
  content_xml  TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  seq          INTEGER NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (owner_id, central_id)
) WITHOUT ROWID;

CREATE INDEX central_entities_pull ON central_entities (owner_id, seq);

-- The counter is meaningless once the rows are gone; a re-seed sets it.
DELETE FROM sync_counter;
