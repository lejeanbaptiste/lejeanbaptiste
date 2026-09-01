# Entity database cross-device sync — planning

**Status (2026-09-01):** **Phase 0 (cloud backup) shipped** — backend, IPC, and
the Settings › Profil › Cloud backup panel; verified running. Open: real R2
smoke test against a provisioned bucket, `safeStorage` check on packaged Linux.
Phases 1–5 (logical entity sync via a Cloudflare D1 central store) not started.

Context: the live `entities.sqlite` cannot live in a file-sync folder
(Nextcloud/Dropbox/iCloud) — the sync client races SQLite's `-wal`/`-shm` and
corrupts the file (observed 2026-09-01: `database disk image is malformed`,
recovered from a clean Nextcloud conflicted-copy). This plan replaces
file-level sync with (0) an off-machine backup and (1+) row-level logical sync.

Decisions locked:

- **Central store:** Cloudflare D1 + a Worker (matches the existing R2 usage,
  the `ljb-leaderboard` Worker, and the GitHub OAuth device-flow identity in
  `leaderboardAuth.ts`).
- **Collaboration model:** one owner, several devices. No per-user roles.
- **Conflict unit:** whole entity, manual resolution (matches the unused
  `sync_conflicts` table shape in `entityDbSqlite/schema.ts`).

## Reuse inventory (already in `apps/desktop/src/entityDbSqlite`)

| Piece                                   | Location                     | Role in sync                               |
| --------------------------------------- | ---------------------------- | ------------------------------------------ |
| `entities.revision` + `bumpEntity()`    | `schema.ts`, `repository.ts` | per-entity dirty counter (no new column)   |
| `computeEntityContentHash()`            | `xmlCodec.ts`                | per-entity fingerprint for change/conflict |
| `exportEntityElementXml()`              | `xmlCodec.ts`                | deterministic single-entity TEI payload    |
| `replaceEntityContentFrom()`            | `repository.ts`              | apply a snapshot onto a local row          |
| `transaction()`                         | `repository.ts`              | nestable `BEGIN IMMEDIATE`                 |
| `central_mappings` (in use)             | `schema.ts`                  | local id ↔ central id ↔ `user_stable_id`   |
| `sync_state`, `sync_conflicts` (unused) | `schema.ts`                  | cursor/hash bookkeeping + conflict queue   |

## Phases

| #   | Scope                                                                                              | Status      |
| --- | -------------------------------------------------------------------------------------------------- | ----------- |
| 0   | Cloud backup: `VACUUM INTO` snapshot → gzip → R2, on a timer + on quit; restore                    | **shipped** |
| 1   | D1 schema + Worker (`/sync/pull`, `/sync/push`) + single-owner auth                                | not started |
| 2   | Client sync module: dirty set, pull/apply, push, `sync_state` bookkeeping                          | not started |
| 3   | Conflict detection → `sync_conflicts`, block push on open conflict                                 | not started |
| 4   | IPC + preload + renderer UI (sync status, conflict-resolution dialog)                              | not started |
| 5   | Hardening: large-batch cold sync, interrupted-sync recovery, backfill hash-guard, two-machine soak | not started |

Full phase detail, endpoints, and the D1 data model: see the working plan
(shared as a Claude artifact 2026-09-01) — fold into this doc when Phase 1 starts.

---

## Phase 0 — cloud backup (implemented)

### What it does

- **Timer:** every `intervalMinutes` (default 15) while the app runs, if backup
  is enabled and configured.
- **On quit:** one best-effort snapshot, run in parallel with renderer teardown
  and capped at 12 s so it cannot hang shutdown (`runQuitBackup`).
- **Snapshot:** `VACUUM INTO` a temp file over a **read-only** connection (safe
  while the app holds its own handle), `PRAGMA integrity_check`, gzip level 6,
  sha256. Measured on the real DB: ~1 s VACUUM (124 MB) + ~3 s gzip → **~30 MB**
  uploaded per snapshot.
- **Upload:** `PUT <prefix>snapshots/entities-<UTC>-<reason>.sqlite.gz` to R2,
  with `x-amz-meta-{sha256,source-bytes,app-version,reason}`.
- **Retention** (`selectSnapshotsToPrune`): keep the newest 24, then the newest
  one per UTC day for 14 days, delete the rest. Steady state ≈ 38 objects ≈
  1.1 GB — inside the R2 free tier; egress is free.
- **Restore** (`restoreSnapshot`): download → sha256 check → gunzip → integrity
  check → move live `entities.sqlite`(+`-wal`/`-shm`) into a `pre-restore-<UTC>/`
  folder → swap the snapshot in. Caller must close SQLite handles first and
  reload/relaunch after.
- **Startup gate** (`checkEntityDbIntegrity`): cheap `integrity_check`; a
  failure is meant to drive a "restore from cloud" prompt (wired in Phase 0 UI).

### Files

| File                                                    | Purpose                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/desktop/src/r2Client.ts`                          | S3-compatible client for R2. SigV4 signed by hand (no AWS SDK), region `auto`. `putObject`/`getObject`/`headObjectMetadata`/`deleteObject`/`listObjects` (paginated). Signing verified against the canonical AWS SigV4 `get-vanilla` vector.                                                     |
| `apps/desktop/src/entityDbBackupConfig.ts`              | Config persisted **encrypted** via Electron `safeStorage` at `userData/entity-db-backup-config.enc` (the R2 secret is a write credential — not plaintext like the LLM key). `readBackupConfig` (full, main-only), `readBackupConfigView` (redacted, `hasSecret` boolean, safe for the renderer). |
| `apps/desktop/src/entityDbBackup.ts`                    | Orchestration: `createSnapshot`, `runBackup`, `runQuitBackup`, `startBackupTimer`/`stopBackupTimer`, `selectSnapshotsToPrune`, `probeBackupTarget`, `listCloudSnapshots`, `restoreSnapshot`, `checkEntityDbIntegrity`, last-backup marker at `userData/entity-db-last-backup.json`.              |
| `apps/desktop/src/*.test.ts` (r2Client, entityDbBackup) | SigV4 canonicalization + vector, retention logic, key parsing.                                                                                                                                                                                                                                   |

### IPC (`main.ts` → `preload.ts` `electronAPI`)

| Channel                         | Renderer method                | Notes                                                                            |
| ------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| `entityDbBackup:getStatus`      | `entityDbBackupGetStatus`      | `{ config (view), lastBackup, integrity }`                                       |
| `entityDbBackup:setConfig`      | `entityDbBackupSetConfig`      | merge-patch; blank `secretAccessKey` keeps the stored secret; restarts the timer |
| `entityDbBackup:clearConfig`    | `entityDbBackupClearConfig`    |                                                                                  |
| `entityDbBackup:testConnection` | `entityDbBackupTestConnection` | signed LIST against the prefix; merges form patch over stored secret             |
| `entityDbBackup:runNow`         | `entityDbBackupRunNow`         | `runBackup('manual')` — runs even when disabled                                  |
| `entityDbBackup:listSnapshots`  | `entityDbBackupListSnapshots`  |                                                                                  |
| `entityDbBackup:restore`        | `entityDbBackupRestore`        | closes cached read repos first; caller must reload after                         |

### Configuring (until the Settings panel exists)

End-user setup — creating the R2 bucket and a bucket-scoped API token, then the
DevTools-console `entityDbBackupSetConfig` / `…TestConnection` / `…RunNow`
calls, plus restore and troubleshooting:
[entity-db-cloud-backup-setup.md](entity-db-cloud-backup-setup.md).

### Done

- **Settings UI** — Settings › Profil › _Cloud backup_
  (`sections/profile/desktop-entity-backup.tsx`, via the `__ljbCommonsUi`
  bridge): enable toggle, credential form, Test connection, Save, Back up now,
  last-backup line, integrity-failure alert, `safeStorage`-unavailable warning,
  and a Restore… expander (snapshot dropdown + armed confirm).

### Still open for Phase 0

- **Corrupt-DB startup prompt** — `checkEntityDbIntegrity` runs and the panel
  shows a red alert, but there's no on-launch dialog offering a one-click
  restore yet.
- **Real R2 smoke test** against a provisioned bucket + token.
- **Packaged-build check** that `safeStorage` encryption is available on the
  target OSes (Linux needs an unlocked keyring).
