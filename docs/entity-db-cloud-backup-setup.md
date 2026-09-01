# Entity database cloud backup — setup

**Status (2026-09-01):** Shipped. Configure it in **Settings › Profil › Cloud
backup** (step 5); the DevTools-console route still works as an alternative.
Implementation notes: [entity-sync-planning.md](entity-sync-planning.md).

Le Jean-Baptiste can copy your entity database (`entities.sqlite`) to
[Cloudflare R2](https://developers.cloudflare.com/r2/) on a timer and once more
when you quit. Each backup is a consistent, compressed, integrity-checked
snapshot of the whole database. If the local file is ever lost or corrupted,
you restore the newest snapshot in one step.

**What this is and isn't:**

- It **is** an off-machine safety net. Keep the live `entities.sqlite` on a
  local disk (never in Dropbox/iCloud/Nextcloud — that corrupts SQLite); let
  this feature hold the backup copy.
- It is **not** multi-machine sync. Restoring a snapshot on machine B
  _replaces_ B's database with A's. Real row-level sync between machines is a
  later phase ([entity-sync-planning.md](entity-sync-planning.md)).
- R2 is object storage, not a database service. Nothing runs "in the cloud" —
  LJB just uploads and downloads snapshot files. (The Cloudflare **D1**
  database used by the future sync work is separate and not needed here.)

---

## 1. Create a Cloudflare account and enable R2

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com/) (a free
   account is fine).
2. In the left sidebar, open **R2**. The first time, Cloudflare asks you to add
   a billing method to activate R2. The free allowances cover this backup with
   large margin — see [Cost](#cost) below.

## 2. Create a bucket

1. **R2 → Overview → Create bucket**.
2. Name it, e.g. `ljb-entity-backups`. (Bucket names are account-global and
   can't be renamed.)
3. Location: **Automatic** is fine. Storage class: **Standard**.
4. Create. Leave public access **off** — backups must stay private.

## 3. Note your S3 API endpoint

On the bucket's **Settings** tab (or the R2 **Overview** page) find the
**S3 API** URL. It looks like:

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com/ljb-entity-backups
```

You need the origin part only — copy:

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

`<ACCOUNT_ID>` is a 32-character hex string, also shown on the R2 Overview page.

## 4. Create a scoped API token

1. **R2 → Overview → Manage R2 API Tokens → Create API token** (or **Create
   Account API token** on newer dashboards).
2. **Token name:** something like `ljb-entity-backup`.
3. **Permissions:** **Object Read & Write** — _not_ Admin Read & Write.
4. **Specify bucket(s):** **Apply to specific buckets only** → select
   `ljb-entity-backups`. Don't grant account-wide access.
5. **TTL:** leave as "Forever", or set an expiry and rotate later.
6. **Create API Token.** The next screen shows, once only:
   - **Access Key ID**
   - **Secret Access Key**
   - the S3 endpoint (same as step 3)

   Copy the Access Key ID and Secret Access Key now. The secret is not shown
   again — if you lose it, delete the token and make a new one.

## 5. Configure Le Jean-Baptiste

Open **Settings → Profil → Cloud backup**. Paste the endpoint, bucket, access
key ID and secret from step 4, set the interval, tick **Back up
automatically**, then **Test connection** and **Save**. Use **Back up now** for
the first snapshot. Restore is the **Restore…** button in the same panel.

<details>
<summary>Alternative: the DevTools console</summary>

1. Launch LJB (a development build, or a packaged build started with
   `LJB_OPEN_DEVTOOLS=1`).
2. Open DevTools (**View → Toggle Developer Tools** in a dev build) and pick
   the **Console** tab.
3. Paste, with your values filled in:

   ```js
   await window.electronAPI.entityDbBackupSetConfig({
     enabled: true,
     endpoint: 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
     accessKeyId: '<ACCESS_KEY_ID>',
     secretAccessKey: '<SECRET_ACCESS_KEY>',
     bucket: 'ljb-entity-backups',
     prefix: 'entity-db-backups/', // optional; where snapshots are keyed
     intervalMinutes: 15, // optional; 5–1440, default 15
   });
   ```

4. Verify the credentials with a signed round-trip:

   ```js
   await window.electronAPI.entityDbBackupTestConnection({});
   // → { ok: true, objectCount: 0 }
   ```

5. Take the first backup now:

   ```js
   await window.electronAPI.entityDbBackupRunNow();
   // → { ok: true, key: 'entity-db-backups/snapshots/entities-…-manual.sqlite.gz', uploadedBytes: …, sha256: '…' }
   ```

6. Check status any time:

   ```js
   await window.electronAPI.entityDbBackupGetStatus();
   // → { config: {…, hasSecret: true}, lastBackup: {at, key, …}, integrity: {ok: true} }
   ```

</details>

The credential blob is stored **encrypted** on your machine via Electron
`safeStorage` (macOS Keychain / Windows DPAPI / Linux libsecret), in
`entity-db-backup-config.enc` under the app's user-data directory. It is never
written to `project-prefs.json` and the secret is never sent to the renderer.

## 6. What gets stored

```
s3://ljb-entity-backups/
  entity-db-backups/snapshots/
    entities-20260901T203015Z-manual.sqlite.gz
    entities-20260901T204512Z-timer.sqlite.gz
    entities-20260901T210330Z-quit.sqlite.gz
    …
```

Each object carries `x-amz-meta-sha256`, `-source-bytes`, `-app-version`, and
`-reason`. On a ~140 MB database a snapshot is roughly **30 MB** gzipped.

**Retention** (applied after every successful upload): keep the newest 24
snapshots, then the newest one per UTC day for 14 days; delete the rest.
Steady state is ~38 objects, ~1.1 GB.

## 7. Restore

1. Quit all but one LJB window.
2. In the console:

   ```js
   const snaps = await window.electronAPI.entityDbBackupListSnapshots();
   snaps.slice(0, 5); // newest first: [{ key, size, timestamp, reason }, …]

   await window.electronAPI.entityDbBackupRestore(snaps[0].key);
   // → { ok: true, restoredFromKey: '…', previousCopyDir: '…/pre-restore-<UTC>' }
   ```

3. **Restart LJB.** The restored database is now live.

Restore downloads the snapshot, verifies its sha256 and runs
`PRAGMA integrity_check`, moves the current `entities.sqlite` (and any
`-wal` / `-shm`) into a `pre-restore-<UTC>/` folder beside it, then swaps the
snapshot in. Nothing is deleted — the previous database stays in that folder
until you remove it.

## Cost

R2's free tier (no per-object egress fees) is far larger than this backup
needs:

| R2 free allowance (per month)        | This backup at 15-min cadence  |
| ------------------------------------ | ------------------------------ |
| 10 GB storage                        | ~1.1 GB steady state           |
| 1,000,000 Class A ops (writes/lists) | ~3,000 (uploads + prune lists) |
| 10,000,000 Class B ops (reads)       | a handful (restores only)      |
| Egress                               | free                           |

## Multiple machines

Point every machine at the **same bucket**. Give each its own API token (easier
to revoke one machine) or reuse one token. Snapshots from different machines
don't collide — the timestamp and `-<reason>` suffix keep keys distinct. But
remember this is backup, not sync: a restore on one machine overwrites that
machine's database with whichever snapshot you pick.

## Rotating or revoking access

- **Rotate:** create a new API token (step 4), run
  `entityDbBackupSetConfig({ accessKeyId, secretAccessKey })` with the new
  values, then delete the old token in the dashboard.
- **Turn off backups but keep credentials:**
  `entityDbBackupSetConfig({ enabled: false })`.
- **Remove credentials from this machine:**
  `entityDbBackupClearConfig()`.
- **Kill access immediately:** delete the token in **Manage R2 API Tokens**.

## Troubleshooting

| Symptom                                                            | Cause / fix                                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `entityDbBackupTestConnection` → `{ ok: false, error: '… 403 …' }` | Token isn't scoped to this bucket, or is Read-only. Recreate with **Object Read & Write** on the specific bucket.              |
| Error mentions `SignatureDoesNotMatch`                             | Wrong secret access key, or the machine clock is off by more than a few minutes. Re-enter the secret; fix the system time.     |
| Error mentions `NoSuchBucket`                                      | `bucket` name or `endpoint` account ID is wrong. The endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` with no path. |
| `entityDbBackupSetConfig` throws about encryption / keychain       | `safeStorage` has no backend. On Linux, log into a session with an unlocked GNOME keyring / KWallet and relaunch.              |
| `getStatus` shows `integrity.ok: false`                            | The local database is damaged — restore the newest snapshot (step 7).                                                          |
| Backups never run on the timer                                     | `enabled` is false, or credentials are incomplete. Check `entityDbBackupGetStatus()`.                                          |
