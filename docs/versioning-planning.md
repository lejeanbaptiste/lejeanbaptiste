# Local file history & rollback — implementation plan

**Status:** Planning complete; **medium priority** (after core Open Project + save flow)  
**Scope:** Desktop app — deduplicated snapshots on save, per-file and project rollback, offline-first  
**Related:** `docs/todo.md`, `docs/project-schema-planning.md`

---

## Summary

LJB stores **local, dated backups of project files on every meaningful save** (content changed). Users recover mistakes via **File → History** (single file) or **Project → Rollback…** (restore many files to a point in time). Works **fully offline**; complements Git but does not replace it.

TEI/XML files are small; full-file snapshots with hash deduplication and retention limits are practical. This is **Time Machine for the project**, not version control (no branches, merge, or blame).

---

## Why this approach

| Approach | Pros | Cons |
|----------|------|------|
| Git only | Branches, remote, collaboration | Steeper curve; useless if user never commits |
| Cloud sync only | Off-device backup | Needs network; not “undo my last hour” |
| **Local history on save (chosen)** | Offline; one app; fast recovery; scholar-friendly | Disk use; not shared across machines unless user copies project |
| Autosave temp files only | Crash recovery | No dated timeline; no project rollback |

**Positioning:** Ship local history **by default**. Optional Git integration remains out of scope for v1.

---

## Locked decisions

### When to snapshot

- **After a successful save** to disk (`saveActiveTab`, and first save after **Save As**).
- **Only if content hash changed** since the last snapshot for that file (SHA-256 of saved bytes). Identical re-saves do not create duplicates.
- **Do not snapshot** temp/untitled tabs until **Save As** assigns a stable path under the project.
- **Do not snapshot** files outside the project root (if ever opened)—history is project-scoped.

### What to snapshot

- **v1:** all `*.xml` under project root (same scope as “apply metadata to all files” in schema planning).
- **Later:** optional include `schema/project-metadata.json`, `schema/tag-colors.json`; exclude generated `schema/tag-colors.css`, `schema/_archive/` (schema backups are separate—see `project-schema-planning.md`).

### Entity database backups (2026-07-04)

Time Machine / rollback UI gets a **second tab** for the **central entity database** (`entities.xml` at the App Settings folder path):

- Snapshot on meaningful save of the database file (same hash-dedup rules as corpus files).
- Storage in the **hidden app folder** (Electron userData — same area as cache and settings).
- User can **delete individual snapshots** from within the Time Machine popup.
- Prominent reminder: the entity database is valuable disambiguation work — back it up.

Project-local `entities.xml` (when `entityStore: "project"`) follows the same snapshot rules but lives in the **Project** tab scope under that project's `.ljb/history/`.

See `docs/Auto-tagging.md` for database location, import-on-switch, and recovery flows.

### Storage layout

```
my-edition/
  jean-baptiste.project.json
  documents/…/*.xml              ← live files
  .ljb/
    history/
      manifest.jsonl             ← append-only index (one JSON object per line)
      files/
        documents/ch01.xml/
          2026-06-27T14-32-01Z-a1b2c3.xml
          …
```

- **`.ljb/`** — hidden project metadata; portable with the project folder; recommend **`.gitignore`** entry (`/.ljb/`) when user uses Git (local safety net, not shared history).
- Snapshot filenames: **ISO-8601 timestamp + short content hash** for uniqueness and debugging.
- **Relative path** from project root preserved under `files/` (mirrors live tree).

### Manifest entry

```typescript
export interface HistoryManifestEntry {
  /** ISO-8601 UTC */
  timestamp: string;
  /** Path relative to project root */
  relativePath: string;
  /** SHA-256 of file bytes at snapshot time */
  contentHash: string;
  /** Path relative to project root, under .ljb/history/files/… */
  snapshotPath: string;
  /** Optional: encoder name from app settings */
  savedBy?: string;
  /** save | rollback-pre | import (optional provenance) */
  reason?: 'save' | 'rollback-pre' | 'import';
}
```

Append one line to `manifest.jsonl` per snapshot. Project rollback queries manifest by timestamp across all paths.

### Retention (defaults; configurable in Settings)

| Rule | Default |
|------|---------|
| Max snapshots **per file** | 50 |
| Max age | 90 days |
| Max total history size | 500 MB (prune oldest globally when exceeded) |

Prune after each new snapshot. Never delete the **only** snapshot younger than 1 hour (safety floor—optional).

### Rollback behaviour

**File → History → This file…**

- List snapshots for active file (newest first): time, optional saved-by, size.
- **Preview** (v2): diff against current or side-by-side read-only.
- **Restore** → confirm → copy snapshot over live file → reload tab if open.
- Before overwrite: take a **`rollback-pre`** snapshot of current live file (so user can undo the undo).

**Project → Rollback…**

- Timeline of **project save events** (distinct timestamps where any file was snapshotted).
- User picks a datetime → show **list of files** that would be restored (each to newest snapshot ≤ chosen time).
- Confirm → restore all listed files → reload affected open tabs.
- **`rollback-pre`** snapshot for every file about to be overwritten.

### Menu & settings

| UI | Action |
|----|--------|
| **File → History…** | Active file timeline + Restore |
| **Project → Rollback…** | Project point-in-time restore |
| **Settings → History** | Enable/disable, retention limits, “backup on save” toggle |

No background scheduler required for v1—**hook save** is enough. (User said “schedule”; interpreted as **on every save**, not cron.)

---

## What already exists

| Capability | Status | Where |
|------------|--------|-------|
| Desktop save to disk | Done | `saveActiveTab`, `useProjectMenu.ts` |
| Save As | Done | `saveActiveTabAs` |
| Reload from disk | Done | `reloadTabFromDisk` |
| SHA-256 hashing | Done | `cwrc-leafwriter-validator/src/conversion.ts` (reuse pattern) |
| Schema file archive | Planned separately | `schema/_archive/` in `project-schema-planning.md` |
| Local file history | **Not done** | — |
| Rollback UI | **Not done** | — |

### Save hook point

After `window.electronAPI.writeFile` succeeds in `saveActiveTab` (and after first write in `saveActiveTabAs`), call **`recordSnapshot(projectRoot, relativePath, content)`** in main or commons layer.

---

## Implementation phases

### Phase 1 — Snapshot on save

- **`historyRecord.ts`** (main or commons): hash, copy file, append manifest, prune.
- Extend **`jean-baptiste.project.json`** optionally:

```typescript
export interface ProjectFileConfig {
  // …existing fields
  history?: {
    enabled?: boolean; // default true
    maxSnapshotsPerFile?: number;
    maxAgeDays?: number;
    maxTotalBytes?: number;
  };
}
```

- IPC: `history:listFile`, `history:listProject`, `history:restoreFile`, `history:restoreProject` (or single `history:restore` with scope).
- Skip snapshot when history disabled or path not under project.

**Deliverable:** Silent backups on save; manifest browsable via devtools or minimal debug UI.

### Phase 2 — File history UI

- **File → History…** dialog: list, Restore, confirm, reload tab.
- **`rollback-pre`** before every restore.

### Phase 3 — Project rollback UI

- **Project → Rollback…** dialog: datetime picker / timeline, affected files preview, Restore all.

### Phase 4 — Polish

- Optional diff preview (Monaco or simple unified diff).
- Include selected non-XML project files in snapshot scope (settings).
- Export history as zip for archival.
- Relation to **`revisionDesc` / last-edited in TEI** (`docs/todo.md` Metadata)—orthogonal; optional note in header on restore, off by default.

---

## Key files (planned)

| File | Role |
|------|------|
| `apps/desktop/src/history/historyRecord.ts` (new) | Snapshot, prune, manifest I/O |
| `apps/desktop/src/history/historyRestore.ts` (new) | File + project restore |
| `apps/desktop/src/history/historyQuery.ts` (new) | List snapshots, project timeline |
| `apps/desktop/src/main.ts` | IPC handlers; menu items |
| `apps/commons/src/overmind/project/actions.ts` | Call history after successful save |
| `apps/commons/src/desktop/useProjectMenu.ts` | Wire File / Project menu |
| `apps/commons/src/dialogs/HistoryDialog.tsx` (new) | Per-file history |
| `apps/commons/src/dialogs/ProjectRollbackDialog.tsx` (new) | Project rollback |
| `apps/commons/src/pages/project/NativeSettingsPage.tsx` | History retention settings |
| `.ljb/history/manifest.jsonl` | Per-project index |

---

## Out of scope (v1)

- Git integration, remote sync, blame, branches
- Real-time collaborative versioning
- Encrypting history at rest
- Snapshots of files outside project root
- Automatic cloud upload of history

---

## Testing plan

| Case | Expect |
|------|--------|
| Save with content change | New snapshot + manifest line |
| Save unchanged content | No new snapshot |
| 51st save on one file | Oldest over limit pruned |
| History &gt; 500 MB | Global prune removes oldest |
| File → History → Restore | Live file replaced; tab reloads |
| Restore | `rollback-pre` snapshot exists |
| Project → Rollback | All affected files restored to ≤ chosen time |
| Temp untitled tab | No snapshots until Save As |
| History disabled in Settings | Save works; no snapshots |
| File outside project | Not snapshotted |
| Open project on second machine | History travels with `.ljb/` folder copy |

---

## Distinction from other features

| Feature | Role |
|---------|------|
| **Local history** (this doc) | Oops recovery; dated file copies |
| **`schema/_archive/`** | TEI RNG/CSS upgrade backup |
| **`revisionDesc` in XML** | Scholarly record inside the document |
| **Git** | Collaboration, publication workflow (optional, external) |

---

## References

- VS Code Local History (conceptual analogue)
- `docs/project-schema-planning.md` — `schema/_archive/` on schema update
- Save path: `apps/commons/src/overmind/project/actions.ts` (`saveActiveTab`)
