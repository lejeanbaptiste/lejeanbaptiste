# grognard-entity-sync

The **reference implementation** of the entity-sync wire protocol
([`docs/entity-sync-protocol.md`](../../docs/entity-sync-protocol.md)) — a
Cloudflare Worker over D1. Any server implementing that contract works; this
one is what the desktop client points at today. Fits into
[`docs/entity-sync-planning.md`](../../docs/entity-sync-planning.md).

## What it does

Server-authoritative whole-entity sync for **one owner** (one account, several
machines). The normative behaviour is the protocol doc; the executable form is
`test/conformance.ts`, which `test/sync.test.ts` runs against this Worker and a
future server would run against its own.

| Route                | Method | Purpose                                                         |
| -------------------- | ------ | --------------------------------------------------------------- |
| `/`                  | GET    | Unauthenticated health check.                                   |
| `/sync/pull`         | GET    | `?since=<seq>&limit=<n>` → every change with `seq > since`.     |
| `/sync/push`         | POST   | `{ entities: [...] }` → `applied` / `reconciled` / `conflicts`. |
| `/sync/achievements` | GET    | Opaque encrypted achievements blob (404 if none).               |
| `/sync/achievements` | PUT    | `{ baseRevision, blob }` → applied or conflict.                 |

Every non-health request carries `Authorization: Bearer <github-token>`. The
Worker calls `GET https://api.github.com/user`, and rejects anyone whose id is
not `OWNER_GITHUB_ID` (401 no/invalid token, 403 wrong account). Scope doesn't
matter — an empty-scope token that can only read `/user` is enough.

### Push semantics (per entity)

`baseRevision` is the central revision the client last held.

- **no `centralId`** → create; server mints `<kind>-<uuid>`, `revision = 1`.
- **`centralId`, unknown to server** → accept the client copy (`revision = baseRevision + 1`); covers a rebuilt central store.
- **`baseRevision` matches stored** → fast-forward; `revision = baseRevision + 1`.
- **`baseRevision` stale, `contentHash` already equals stored** → `reconciled`: no write, client adopts the server revision as its new baseline (absorbs bulk re-hash / backfill churn).
- **`baseRevision` stale, content differs** → `conflict`: nothing written; response carries the server's `revision` / `hash` / `xml` for the client's resolution queue.

`seq` is a per-owner monotonic counter, bumped once per push via
compare-and-swap on `sync_counter`, and is the pull cursor. Writes for one
push commit together (`D1.batch`). Max 200 entities per push (413 otherwise);
the client chunks.

The server stores `content_xml` (the client's `exportEntityElementXml`) and
`content_hash` (`computeEntityContentHash`) verbatim and never reparses the
XML.

## Develop & test

```bash
npm install
npm test          # vitest + @cloudflare/vitest-pool-workers (real D1, migrations auto-applied)
npm run typecheck
```

## Deploy

```bash
# 0. Local config (not committed — see wrangler.toml.example).
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml: paste your D1 database_id and OWNER_GITHUB_ID.
# GitHub numeric id: curl -s https://api.github.com/user -H "authorization: Bearer <token>" | jq .id

# 1. Create the D1 database, then paste its id into wrangler.toml.
npx wrangler d1 create grognard-entity-sync

# 2. Apply migrations to the remote database.
npx wrangler d1 migrations apply grognard-entity-sync --remote

# 3. Ship it.
npx wrangler deploy
```

`compatibility_date` and bindings live in `wrangler.toml` (gitignored). The
committed template is `wrangler.toml.example`.

End-user setup for R2 backup + D1 sync on multiple machines:
[`docs/entity-db-multi-machine-setup.md`](../../docs/entity-db-multi-machine-setup.md).

## First full load on the free tier

D1's free plan caps writes at 100k rows/day, and a first sync of a large
authority file (each `central_entities` insert is ~2 index rows) blows past
that. Options:

- **Upgrade to Workers Paid** ($5/mo, 50M writes/mo) — the seed becomes a
  non-event; just press Sync now.
- **Seed out of band.** Generate SQL from a local database, then bulk-import it
  (one file per day if you still trip the cap):
  ```bash
  node ../../apps/desktop/scripts/generate-entity-sync-seed.mjs \
    --owner <github-id> --db /path/to/entities.sqlite
  # writes workers/entity-sync/seed/seed-NNN.sql; run from THIS dir:
  npx wrangler d1 import grognard-entity-sync --remote --file=seed/seed-001.sql
  # …one per day…
  ```
  `d1 import` batches and retries (`d1 execute --file` can choke on the size).
  Then **Sync now** in the app: the pull reconciles every seeded row locally
  (reads only) and finds nothing to push.

If the Worker hits the write cap during a client push it returns
`429 { quota: true }`; the client stops cleanly and retries on a later cycle.
Migration `0003` makes `central_entities` `WITHOUT ROWID` to shave ~⅓ of the
write amplification (it drops and recreates the table — re-seed after).
