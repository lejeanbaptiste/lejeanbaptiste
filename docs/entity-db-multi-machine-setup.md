# Entity database — multi-machine setup (type C)

**Status (2026-09-01):** User-facing guide for advanced users who keep the live
`entities.sqlite` on local disk and use **Cloudflare R2** (off-machine backup)
plus **D1 logical sync** (cross-device entity sync). For R2 bucket/token setup
alone, start with [entity-db-cloud-backup-setup.md](entity-db-cloud-backup-setup.md).

This doc also covers **achievements** (`achievements.json`), which live in the
same folder as the entity database by default.

---

## Three kinds of user

| Type                        | Setup                                                        | Entity database                                                                                        | Achievements                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — Local only**          | Default install                                              | `entities.sqlite` in the app's local data folder                                                       | `achievements.json` next to it — no sync needed                                                                                                              |
| **B — File-sync folder**    | Entity DB or project in Dropbox / iCloud / Nextcloud         | **Do not do this.** SQLite's `-wal` / `-shm` files race with the sync client and corrupt the database. | A lone `achievements.json` in a synced folder is usually fine, but LJB does not optimise for this path                                                       |
| **C — Cloud backup + sync** | Settings › Profil › **Cloud backup** + **Cross-device sync** | Local `entities.sqlite`; R2 holds compressed snapshots; D1 holds row-level entity sync                 | `achievements.json` in the **same folder** as `entities.sqlite` (default). See [Achievements on multiple machines](#achievements-on-multiple-machines) below |

**Type C is the only path this guide is for.** Types A and B need no cloud
configuration.

---

## What each cloud piece does

```
Machine A                          Cloud                         Machine B
─────────                          ─────                         ─────────
entities.sqlite  ──D1 sync──►  central_entities (D1)  ◄──D1 sync──  entities.sqlite
     │                                ▲                              │
     │                                │                              │
     └── R2 backup (snapshots) ──►  R2 bucket  ◄── R2 backup ────────┘
```

- **D1 sync** — day-to-day, two-way, row-level. Edit on either machine, sync,
  changes propagate. Conflicts are resolved in **Settings › Profil › Cross-device
  sync**.
- **R2 backup** — disaster recovery. Whole-database snapshots on a timer and on
  quit. Restoring **replaces** the local database with a chosen snapshot. This is
  not a merge.

Keep the live `entities.sqlite` on a **local disk** on every machine. Never put
it in a file-sync folder (type B).

---

## One-time server setup (deploy the sync Worker)

Do this once per Cloudflare account. Source lives in
[`workers/entity-sync/`](../workers/entity-sync/).

```bash
cd workers/entity-sync
npm install
cp wrangler.toml.example wrangler.toml
```

Edit `wrangler.toml`:

1. **`OWNER_GITHUB_ID`** — your numeric GitHub user id (not secret; it gates who
   may sync). Find it with a signed-in token:
   `curl -s https://api.github.com/user -H "authorization: Bearer <token>" | jq .id`
2. **`database_id`** — create the database and paste the id Wrangler prints:

```bash
npx wrangler d1 create ljb-entity-sync
npx wrangler d1 migrations apply ljb-entity-sync --remote
npx wrangler deploy
```

Note the deployed URL (e.g. `https://ljb-entity-sync.<your-subdomain>.workers.dev`).
You will enter it in LJB on each machine. `wrangler.toml` is gitignored so your
ids stay on your machine.

R2 setup (bucket + scoped API token) is separate — see
[entity-db-cloud-backup-setup.md](entity-db-cloud-backup-setup.md).

---

## Primary machine (first LJB install)

### 1. Entity database

Leave the default local folder, or choose one in **Settings › Profil › Entity
database**. It must be on local disk, not in Dropbox/iCloud.

### 2. Cloud backup (R2)

**Settings › Profil › Cloud backup** — follow
[entity-db-cloud-backup-setup.md](entity-db-cloud-backup-setup.md): endpoint,
bucket, access key, secret, **Test connection**, **Save**, **Back up now**.

### 3. Cross-device sync (D1)

1. Sign in to **GitHub** (leaderboard auth — the same token is used for sync).
2. **Settings › Profil › Cross-device sync**:
   - Enable
   - **Endpoint:** your Worker URL from deploy (no trailing slash)
   - **Authentication:** GitHub
   - **Save**, then **Sync now**
3. Wait for the first full push to finish (large authority files take a while).
   The status line shows the sync cursor when done.

### 4. Achievements

No extra step. `achievements.json` is created next to `entities.sqlite` the first
time you earn progress. It stays there for type C users.

---

## Second machine (onboarding)

Use this when you already have a working type-C setup on machine A.

### 1. Install and sign in

Install the same LJB version if possible. Sign in to **GitHub** with the same
account that owns the sync Worker (`OWNER_GITHUB_ID`).

### 2. Entity database folder

Let LJB create a **new local** entity database folder (default). Do **not**:

- Point at machine A's folder over the network
- Put the folder in Dropbox/iCloud
- R2-restore over an existing database unless you intend to **replace** it

### 3. Cross-device sync (pull)

**Settings › Profil › Cross-device sync** — same endpoint and GitHub auth as
machine A. **Save**, then **Sync now**.

This downloads entities from D1 into the empty local database. Watch the status
line; resolve any conflicts in the same panel if both machines had divergent data
before sync.

### 4. Cloud backup (R2) — recommended on every machine

Configure the **same bucket** as machine A (you may use a separate API token per
machine). **Test connection › Save › Back up now**. Each machine uploads its own
snapshots; keys do not collide.

### 5. Achievements on the second machine

`achievements.json` lives beside `entities.sqlite`. **R2 restore** pulls back the
paired achievements sidecar uploaded with each entity snapshot (when the file
existed on the machine that created the backup). **Cross-device sync** also syncs
the achievements blob through D1 after each entity sync run — use that for
day-to-day updates once both machines are on the same snapshot baseline. The D1
blob is opaque; the app decrypts, merges (`mergeAchievementsStates` semantics),
and re-encrypts locally. No separate setup step.

If machine B was set up before achievements sidecars shipped, run **Sync now**
once on each machine so blobs converge.

---

## When to use R2 restore instead of D1 pull

| Situation                                    | Use                                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh second machine, normal workflow        | **R2 restore** (newest snapshot) for a full clone, then **D1 sync** for deltas; or **D1 pull** into an empty DB if you accept cold-pull limits |
| Local `entities.sqlite` corrupted or missing | **R2 restore** (newest snapshot) — restores `entities.sqlite` and the paired `achievements.json` sidecar when present                          |
| Clone machine A's DB at a point in time      | **R2 restore** of a chosen snapshot                                                                                                            |
| Machine B already has its own entity work    | **D1 sync** — expect conflicts; do not restore over it                                                                                         |

After an R2 restore, enable D1 sync if it is not already on; the restored file
may already carry a sync cursor from the machine that created the snapshot.

---

## Checklist

**Server (once)**

- [ ] `wrangler.toml` from example, D1 created, migrations applied, Worker deployed
- [ ] R2 bucket + scoped token created

**Each machine**

- [ ] Local entity database folder (not cloud-synced)
- [ ] GitHub signed in
- [ ] Cross-device sync: endpoint set, enabled, **Sync now** succeeds
- [ ] Cloud backup: credentials saved, **Test connection** ok
- [ ] Second machine only: run **Sync now** on both machines after upgrading if medals were set up before blob sync shipped

**Spot checks**

- [ ] Edit an entity on A → sync → sync on B → change visible
- [ ] `entityDbBackupGetStatus` / panel shows `integrity.ok: true`
- [ ] Open conflicts panel empty after a quiet sync week (or resolve one test conflict)

---

## Troubleshooting

| Symptom                            | Likely cause                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Sync returns 403                   | GitHub account ≠ `OWNER_GITHUB_ID` on the Worker                                                                                           |
| Sync returns 401                   | Not signed in to GitHub, or token expired — sign in again                                                                                  |
| `database disk image is malformed` | Live DB in a file-sync folder — restore from R2, move DB to local disk                                                                     |
| B has entities but no medals       | **R2 restore** from a snapshot taken after machine A had medals, or run **Sync now** (achievements blob on D1)                             |
| Restore did not fix medals         | Snapshots before this release only backed up `entities.sqlite` — run entity sync to pull achievements from D1, or restore a newer snapshot |

Wire protocol and server behaviour:
[entity-sync-protocol.md](entity-sync-protocol.md). Implementation planning:
[entity-sync-planning.md](entity-sync-planning.md).
