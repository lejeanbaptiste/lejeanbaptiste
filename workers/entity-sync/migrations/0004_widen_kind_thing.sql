-- Widen central_entities' `kind` CHECK to allow 'thing' — the tag-bomb
-- custom sub-types feature now syncs `thing` entities too. SQLite can't
-- ALTER a CHECK constraint in place, so rebuild the table; unlike 0003 this
-- preserves existing rows via a copy (there's live data now).

CREATE TABLE central_entities_new (
  central_id   TEXT NOT NULL,
  owner_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('person', 'place', 'work', 'office', 'org', 'thing')),
  revision     INTEGER NOT NULL,
  content_xml  TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  seq          INTEGER NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (owner_id, central_id)
) WITHOUT ROWID;

INSERT INTO central_entities_new SELECT * FROM central_entities;

DROP INDEX IF EXISTS central_entities_pull;
DROP TABLE central_entities;
ALTER TABLE central_entities_new RENAME TO central_entities;

CREATE INDEX central_entities_pull ON central_entities (owner_id, seq);
