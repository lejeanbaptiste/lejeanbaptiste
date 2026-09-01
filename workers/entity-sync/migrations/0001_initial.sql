-- Central entity store for cross-device sync.
-- Phase 1 of docs/entity-sync-planning.md. Server-authoritative revisions;
-- one owner per deployment (OWNER_GITHUB_ID). `content_xml` is the client's
-- exportEntityElementXml() payload; `content_hash` is its
-- computeEntityContentHash() — the server stores both verbatim and never
-- reparses the XML.

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
);

-- Pull cursor: "every change with seq > ?" ordered by seq.
CREATE INDEX central_entities_pull ON central_entities (owner_id, seq);

-- Monotonic per-owner sequence, bumped once per push via compare-and-swap.
CREATE TABLE sync_counter (
  owner_id TEXT PRIMARY KEY,
  last_seq INTEGER NOT NULL
);
