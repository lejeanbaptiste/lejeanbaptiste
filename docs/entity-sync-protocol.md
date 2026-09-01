# Entity-sync wire protocol

The contract between the desktop client (`apps/desktop/src/entitySync*.ts`) and
a sync server. It is deliberately small — two endpoints, bearer auth, JSON —
so the server can be anything: the reference is a Cloudflare Worker over D1
(`workers/entity-sync/`), but a Node + Postgres service on other infrastructure
(e.g. huma-num) implements the same contract.

**Executable form:** `workers/entity-sync/test/conformance.ts` — a set of
scenarios run against any `ConformanceClient`. A new server should pass all of
them.

**Version:** 1 (2026-09-01). Breaking changes bump this and the client's
minimum-server check.

---

## Model

- The unit of sync is a **whole entity**. The client sends its TEI export
  (`exportEntityElementXml`) as `contentXml` and the matching hash
  (`computeEntityContentHash`) as `contentHash`. **The server stores both
  verbatim and never parses the XML.**
- **One owner per deployment.** Every request carries a bearer token; the
  server verifies it with its identity provider and rejects any principal that
  is not the configured owner. The token's provider is the server's choice
  (GitHub, OIDC/Keycloak, …); the client selects a matching token via
  `config.auth.mode`.
- **`revision`** is a per-entity counter the server owns. A push is accepted
  only when the client's `baseRevision` still matches the stored revision;
  otherwise it is a conflict (or a no-op reconcile if the content already
  matches).
- **`seq`** is a per-owner monotonic integer, unique, assigned when an entity
  row is written. It is the pull cursor: "give me every change with
  `seq > since`". It need not be gapless.
- **id equality.** `centralId` is omitted on an entity's first push; the server
  then adopts `localId` as the central id. Both are kind-prefixed UUIDs
  (`person-<uuid>` etc.), so `id = centralId ?? localId` is globally unique and
  local id == central id for every entity.

---

## Endpoints

Base URL is the configured `endpoint` (no trailing slash). All bodies are
`application/json`.

### `GET /` — health

Unauthenticated. `200 → { "ok": true, "service": "ljb-entity-sync" }`. The
`service` string is informational.

### `GET /sync/pull?since=<int>&limit=<int>`

Returns every change for the owner with `seq > since`, ordered by `seq`.

- `since` — non-negative integer, default `0`.
- `limit` — positive integer, default `500`, server may cap (reference caps at
  `1000`). Invalid `since`/`limit` → `400`.

```jsonc
// 200
{
  "changes": [
    {
      "centralId": "person-8a1f…",
      "kind": "person" | "place" | "work" | "office" | "org",
      "revision": 3,
      "contentXml": "<person …>…</person>",   // "" when deleted
      "contentHash": "…",                      // "" when deleted
      "deleted": false,
      "seq": 41
    }
  ],
  "highSeq": 41,        // max seq in this page, or `since` if empty
  "hasMore": true       // true iff changes.length === the effective limit
}
```

### `POST /sync/push`

```jsonc
{
  "entities": [
    {
      "localId": "person-8a1f…", // required, non-empty
      "centralId": "person-8a1f…", // omit on first push
      "kind": "person", // enum as above
      "baseRevision": 2, // non-negative int; 0 = never synced
      "contentXml": "<person …/>", // "" only when deleted
      "contentHash": "…", // "" only when deleted
      "deleted": false, // optional, default false
    },
  ],
}
```

- At most **200** entities (`413` otherwise — the client chunks).
- Empty or malformed array → `400`.
- All accepted writes in one push **commit atomically**.

```jsonc
// 200
{
  "applied": [{ "localId": "…", "centralId": "…", "revision": 3, "seq": 42 }],
  "reconciled": [{ "localId": "…", "centralId": "…", "revision": 3, "seq": 40 }],
  "conflicts": [
    {
      "localId": "…",
      "centralId": "…",
      "serverRevision": 3,
      "serverHash": "…",
      "serverXml": "<person …/>",
      "serverDeleted": false,
    },
  ],
  "highSeq": 42,
}
```

### Push classification (per entity)

`id = centralId ?? localId`.

| Condition                                                                     | Bucket       | Effect                                                                                                         |
| ----------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| `id` not stored                                                               | `applied`    | insert; `revision = max(baseRevision, 0) + 1` (1 on a true first push, higher when re-seeding a rebuilt store) |
| `stored.revision === baseRevision`                                            | `applied`    | overwrite; `revision = baseRevision + 1`, new `seq`                                                            |
| stale `baseRevision`, `stored.contentHash === contentHash` and same `deleted` | `reconciled` | **no write**; echo the stored `revision`/`seq` so the client re-baselines. Absorbs bulk re-hash churn.         |
| stale `baseRevision`, content differs                                         | `conflicts`  | **no write**; return the server's copy for the client's resolution queue                                       |

`applied` and `reconciled` never overlap; a `localId` appears in exactly one
bucket.

---

## Auth

`Authorization: Bearer <token>` on every request except `GET /`.

| Outcome                                               | Status |
| ----------------------------------------------------- | ------ |
| missing / malformed token, or the provider rejects it | `401`  |
| valid token, but not the owner principal              | `403`  |

Error bodies are `{ "error": "<human string>" }`. Token **scope** is
irrelevant — the server only needs to resolve identity.

The client picks the token by `config.auth.mode` (see
`apps/desktop/src/entitySyncTokenProvider.ts`):

- `github` — the cached GitHub OAuth-device token (same identity as the
  leaderboard). Server verifies against `GET https://api.github.com/user`.
- `bearer` — a static token the user pastes, kept encrypted client-side.
- `oidc` — an OpenID Connect device flow against `config.auth.issuer` /
  `clientId`. **Client side not implemented yet**; lands with the first
  non-Cloudflare server.

---

## Client expectations of the server

- **Idempotent retries.** The client retries `5xx` / `429` / network failures
  with backoff, and re-sends whole chunks. Re-applying a push whose entities
  already landed at the same `(baseRevision → revision)` must be a safe
  reconcile, not a conflict.
- **`seq` monotonic and unique per owner.** Two concurrent pushes from the
  same owner must not hand out the same `seq` (the reference uses a
  compare-and-swap counter).
- **No cross-request ordering guarantees needed** — the client always pulls
  before it pushes, then drains once more after pushing.

## Left to the server (not specified here)

Storage engine; how `seq` is allocated; how identity is verified and how the
owner is configured (single id, allow-list, real multi-tenant); rate limiting;
retention / compaction of superseded revisions.
