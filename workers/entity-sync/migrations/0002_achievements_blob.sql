-- Encrypted achievements.json blob per owner (opaque to the server).
CREATE TABLE achievements_blob (
  owner_id   TEXT PRIMARY KEY,
  revision   INTEGER NOT NULL,
  blob       TEXT NOT NULL,
  sha256     TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
