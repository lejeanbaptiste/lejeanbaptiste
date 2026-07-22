# Dual entity database & bridge — planning

**Status:** Largely implemented (2026-07-23) — see "Implementation status" below  
**Original status:** Planning (2026-07-22)

---

## Implementation status (2026-07-23)

The sync architecture landed in one pass (Phases 1–4 of the plan in
`entity-registry-merges-and-splits.md` § Reflections). What shipped, and the two
decisions that superseded this doc's original locks:

**Superseded lock — central ids are now UUIDs too.** §Id schemes below says
central keeps sequential ids; that was overturned: `mintEntityId` (kind-prefixed
UUID) now serves **both** databases, because sequential central ids collide the
moment two machines mint `person-000043` for different people — which the
fork-merge story (Story F) requires to never happen. Existing sequential ids are
grandfathered (`nextEntityId` still scans them; nothing is bulk-rewritten).

**Architecture change — the order log replaced the registry as the correctness
backbone.** Merges/deletes now append a durable, timestamped, db-scoped remap to
`entity-orders.jsonl` beside `entities.xml` (`entityOrders.ts`); every project
checkout replays unapplied orders on open via a per-machine cursor
(`applyOrders.ts`), idempotently. The path registry survives only as an
eager-crawl optimization and its destructive prune is gone (`registerProject`
never drops entries it can't `pathExists` — that prune *was* the Story A–F bug).

Shipped modules (all in `packages/cwrc-leafwriter/src/autoTagging/` unless noted):

| Piece | Module |
|---|---|
| Per-entity `changed` timestamp (`<note type="ljb-changed" when>`) | `entities.ts` — `touchEntity`/`getEntityChanged`/`backfillEntityTimestamps` |
| UUID minting both sides | `entities.ts` — `mintEntityId` |
| `ljb-central` concordance rows | `concordance.ts` |
| `userStableId` in `{entityDbFolder}/user-id.txt` | `userStableId.ts` |
| Per-corpus-file PEDB stamp (`<idno type="ljb-project-database">`) | `corpusStamp.ts` |
| Order log + cursor + compose/union | `entityOrders.ts`; replay in `apps/commons/.../entityDb/applyOrders.ts` |
| Classified orphan sweep (genuine vs stray-file) | `orphanSweep.ts`; orchestrated in `entityDatabaseCheck.ts`; gentle prompt on open in `useEntityDatabaseLifecycle.ts` |
| Field-level reconcile (union/fill/conflict) | `reconcile.ts` |
| Link / Promote (authority-first) | `promote.ts` |
| Bridge inbox (unlinked/broken/syncable/conflict) | `bridgeInbox.ts`; dialog `apps/commons/.../sidebar/BridgeInboxDialog.tsx` (Hub icon in the database toolbar) |
| Central Time Machine tab | `TimeMachineDialog.tsx` — snapshots the central folder into its own `.ljb-time-machine` (roams with the folder); restore preserves the order log via `unionOrderLogs` |
| Fork-merge of two central copies | `centralForkMerge.ts` (engine + tests; menu entry point still to wire) |

Deliberate semantics worth remembering:

- Corpus `@key`s are **never** touched by Link/Promote/reconcile — only Absorb
  (via the order log + remap) rewrites keys.
- Writing an `ljb-central` mapping does **not** bump the entity's `changed`
  timestamp (per-user metadata must not fake content recency).
- Fork-merge treats absence as *addition on the other side*, never deletion —
  deletions travel exclusively through the order log.
- A lost/blank order cursor costs a redundant scan, never correctness (replay is
  idempotent).

Still open: fork-merge UI entry point; conflict-resolution UI beyond the inbox
list (currently resolve by editing either record); i18n for the new dialog
strings; workshop-chapter copy (Phase E below).

---  
**Scope:** Desktop app — personal central `entities.xml` **and** per-project `entities.xml`, with an interpretation layer (bridge) between them; collaboration via shared project DB; separate rollbacks  
**Related:** [`Auto-tagging.md`](Auto-tagging.md) (current single-store model), [`Auto-tagging-phases.md`](Auto-tagging-phases.md) Phase 3, [`versioning-planning.md`](versioning-planning.md), [`entity-database-viewer-planning.md`](entity-database-viewer-planning.md), [`import-planning.md`](import-planning.md), [`entity-registry-merges-and-splits.md`](entity-registry-merges-and-splits.md) (plain-language explainer: registry fragility, merge blast radius, why split is hard)

---

## Summary

Today a project chooses **either** a central entity database **or** a project-local one (`entityStore: "central" | "project"`). Mentions use bare sequential ids (`person-000001`) that only make sense inside whichever file is attached.

This plan replaces that either/or with **both layers always present for a normal project**:

1. **Project `entities.xml`** — the shared edition’s authority list. Corpus `@key` values always point here.
2. **Central `entities.xml`** — one scholar’s lifelong personal index (Norbert-style). Never required for collaborators to open the project.
3. **Bridge** — link / promote / absorb operations that keep the two files aligned for *one user*, using authority `<idno>`s first and a per-user mapping when ids differ.

**Collaboration rule:** two or more people may share a corpus **only if they accept the same project `entities.xml`**. Personal central databases stay private. No LJB-hosted SQL server; sync of the project folder remains Git and/or cloud (Dropbox, iCloud) with sequential edits of the shared entity file.

**Root folder:** no longer required. Projects may live anywhere; the central DB lives in the user-chosen folder from App Settings. Nesting projects under that folder remains a *suggestion* for personal roaming, not a hard law.

---

## Why this approach

| Approach | Pros | Cons |
|----------|------|------|
| Central only (today’s default) | One personal brain | Collaboration on tagged corpora is fragile; ids collide across users |
| Project only (today’s opt-in) | Easy to share a folder | No lifelong personal index; re-disambiguate across editions |
| Hosted SQL / online DB | True multi-writer | Ops you do not want to run; XML ceases to be the scholar-visible source of truth |
| Full CRDT / real-time merge of `entities.xml` | Concurrent edit | High complexity; poor fit for sequential TEI ids and DH workflows |
| **Dual store + bridge (chosen)** | Personal brain + sharable edition; reuses TEI/`@key`/remap; no server | Bridge UX and staleness checks to build; concurrent edit of project DB still discouraged |

**Positioning:** The project file is the **source of truth for the edition**. The central file is a **personal index** that may lag. Corpus mentions speak only project language (UUIDs).

---

## Locked decisions

### Layers and what `@key` means

- Every collaborating project has a **project-local** `entities.xml` at `<projectRoot>/entities.xml`.
- Corpus mentions always use `@key` = **project entity id** (UUID — see below). They **never** point at central ids.
- Each user may also have a **central** `entities.xml` at `{entityDbFolder}/entities.xml` (App Settings). Linking to central is optional enrichment, not required to open or tag the project.
- Project JSON stores the project database fingerprint (`entityDatabaseId`) as today. Mismatch → warn (Cancel / Import / Purge paths from current recovery design still apply to the **project** file).

### Id schemes

| File | `xml:id` scheme | Rationale |
|------|-----------------|-----------|
| **Project** `entities.xml` | Kind-prefixed UUID, e.g. `person-a1b2c3d4-e5f6-7890-abcd-ef1234567890` (**locked**, see below) | Collision-safe when multiple people mint entities without coordinating sequential counters |
| **Central** `entities.xml` | Keep typed sequential ids (`person-000042`, …) | Readable in a personal viewer; no need for global uniqueness |

**Locked: always prefix with the kind, never a bare UUID.** This isn't only a readability preference — a bare UUID is frequently **not a legal `xml:id`**. XML's NCName grammar forbids a name starting with a digit, and canonical UUIDs start with `0`–`9` close to half the time. A bare-UUID `xml:id` will validate today and then break the moment the RNG mints one that starts with a digit, which is exactly the kind of intermittent failure that's miserable to trace back to "this one entity." The kind prefix (`person-`, `place-`, …) also keeps `nextEntityId`-style scans and human debugging sane, matching the convention central already uses.

UUIDs fix **identifier** collisions. They do **not** fix two records for the same historical person. Identity still comes from authority `<idno>`s + human merge (Absorb).

### Mapping (“interpretation layer”)

**Locked: store the bridge on the project entity as TEI `<idno>` rows, not a gitignored sidecar.** The value leaked to collaborators is an opaque central id string, not the rest of anyone's central DB — a modest privacy cost worth paying for the portability a sidecar can't offer (sidecars increase forgetfulness and do not travel with Git as cleanly; a `.ljb/central-links.json` also just silently vanishes for anyone who clones the repo fresh).

```xml
<person xml:id="person-a1b2c3d4-e5f6-7890-abcd-ef1234567890">
  <persName>張衡</persName>
  <idno type="CBDB">3004</idno>
  <idno type="Wikidata">Q197132</idno>
  <!-- per-user link into that user’s central database -->
  <idno type="ljb-central" subtype="‹userStableId›">person-000042</idno>
</person>
```

- `type="ljb-central"` — value is the central `xml:id` for this user.
- `subtype` — stable **user** id (not machine path): a UUID minted once, so the same person on two machines writes the same subtype.
- **Locked: store `userStableId` inside the central entity DB folder itself** (e.g. `{entityDbFolder}/user-id.txt`), **not** in Electron `userData`. `userData` is per-machine and is never what the "same person on two machines" requirement can rely on — this doc's whole premise is that the central folder is the thing the user already puts in Dropbox/iCloud for roaming (see "Personal multi-machine" above), so `userStableId` inherits that roaming property for free by living there too. Minting it in `userData` instead would silently produce a *second* `userStableId` the first time the user opens the app on a second machine, splitting one scholar into two `ljb-central` rows on every entity they've linked — directly defeating the stated goal. First run with no central folder configured yet: mint a session-local id and persist it into the folder as soon as one is set.
- Multiple collaborators → multiple `ljb-central` rows on the same project person (one per `subtype`). That reveals only central id *strings*, not the rest of anyone’s central DB.
- When in doubt, matching prefers **authority associations** present in either file (same CBDB / Wikidata / …) over name-only guesses.

### Collaboration

- Sharing a project = sharing the project folder (corpus + project `entities.xml` + `jean-baptiste.project.json`).
- Collaborators **must** use that project `entities.xml`. Do not switch the project to “central only.”
- Central DBs are **not** shared with the team.
- Concurrent writers on project `entities.xml` remain **unsupported** (same deferred constraint as today). Teach: pull/wait for sync, one librarian moment for entity create/merge; tagging mentions is the common path.
- **Be explicit this is a workflow constraint, not a solved technical problem.** UUIDs remove *identifier* collisions (two people no longer mint the same key for different people), but they do nothing about the ordinary git text conflict that happens when two collaborators both append a new `<person>` near-simultaneously — new entities almost always land at the same insertion point (end of list), so this is the *common* case for a conflict, not an edge case. The collaboration banner (see UI sketch) should say this outright — something like "Entity additions can conflict like any shared file; if Git flags `entities.xml`, keep both `<person>`/`<place>`/… blocks and re-open the project" — rather than leaving first-timers to discover it as what looks like a data-loss bug report.
- Transport: Git and/or cloud sync of the project folder (Workshop pedagogy). LJB does not run a sync server.

### Personal multi-machine (central DB)

- Central folder may live in Dropbox/iCloud for roaming; sequential use of central `entities.xml`.
- Projects need not live inside that folder.
- **Known issue, not just a someday cleanup — see "Registry fragility" below:** `entity-projects.json`'s absolute paths break across OS checkouts *and* the current self-healing behavior actively drops other machines' entries, not just stale ones.

### Registry fragility (why this can't wait for "after bridge v1")

Plain-language scenarios, merge/split edge cases, and dual-model morals: [`entity-registry-merges-and-splits.md`](entity-registry-merges-and-splits.md).

`entity-projects.json` (`entityProjectRegistry.ts`) exists so that Absorb/merge key-remap knows every project tree to rewrite when two entity records collapse into one. Today's design: every project checks itself in on open (`registerProject`), and — critically — that same call **prunes any registered root that doesn't `pathExists` from the current machine's point of view** before re-adding itself.

That pruning is the problem for exactly the roaming workflow this plan re-affirms as supported:

1. Open the project on machine A → registry gets `/Users/daniel/editions/han-commentary`.
2. Open the same project (synced via Git) on machine B → `registerProject` checks the existing entry, finds `/Users/daniel/...` doesn't exist on machine B (different OS, different home dir, different mount), **silently drops it**, and writes only machine B's own path.
3. Absorb a duplicate entity back on machine A, having not reopened the project since step 2 → `resolveProjectRoots` no longer sees machine B's path (it was never re-added there, and machine A's own re-registration on next open doesn't restore *B*'s entry either) → the remap can miss project trees that are only ever visible from the other machine's checkout.

So this isn't a hypothetical edge case or generic tech debt — it's a correctness bug in the specific "roam your central DB across machines" feature this plan exists to deliver, and it'll surface the first time a scholar actually uses two machines with the same project, which this doc explicitly expects to be a normal workflow. I'd resolve it in Phase A or B (id-based registry entries — a stable `projectId` already exists in the project JSON's fingerprint machinery — rather than raw absolute paths, so an entry from a machine that currently can't `pathExists` it doesn't get treated as garbage), not defer it behind Phase C's bridge operations that depend on the registry being trustworthy in the first place.

### Three bridge verbs (do not collapse into one “Merge”)

| Verb | Meaning | Touches corpus `@key`? |
|------|---------|-------------------------|
| **Link** | Project UUID ↔ existing central id (write `ljb-central` mapping) | No |
| **Promote** | Create (or authority-match) a central record from a project entity, then Link | No |
| **Absorb** | Two project entities (or two central entities) are the same person; keep one, remap keys / mappings | **Yes** for project-side absorb (remap `@key` across registered corpus files) |

Matching order for Link / Promote:

1. Same authority `<idno>` type+value → auto-suggest Link (high confidence).
2. Known cross-authority equivalences → suggest.
3. Normalized name + kind only → suggest with warning.
4. Nothing → Promote creates a new central record, then Link.

### Staleness (“forgot to update”)

On project open (and optionally from a Bridge inbox UI):

- Project entities with no `ljb-central` for **this** `userStableId` → “N unlinked — Promote or Link?”
- `ljb-central` pointing at a missing central id → clear mapping + offer re-link.
- Central gained new authority ids since last link → optional “refresh from central” (copy authorities onto project entity if project lacks them — **never** rewrite corpus keys to central ids).

Central may lag the edition. That is acceptable; the inbox makes lag visible.

### Rollbacks — separate timelines

Align with [`versioning-planning.md`](versioning-planning.md):

| Scope | History location |
|-------|------------------|
| Corpus + **project** `entities.xml` | `<project>/.ljb/history/` (Project tab) |
| **Central** `entities.xml` | Electron userData (Entity database tab) |

**Rule:** restoring one file does **not** auto-restore the other or the corpus.

After rollback, run orphan checks:

- Project entities restored/deleted → scan corpus for `@key`s with no project entity; offer purge key / reconstitute stub / cancel.
- Central restored → clear or re-link broken `ljb-central` rows for this user; **do not** rewrite corpus.
- Corpus file restored → may revive old UUIDs; if project DB absorbed them away, orphan/`@key` remap UI.

Always take a `rollback-pre` snapshot before overwrite (existing versioning plan).

---

## Mental model (SQL analogy for teaching)

| SQL idea | LJB dual model |
|----------|----------------|
| Shared team database | Project `entities.xml` |
| Personal research DB | Central `entities.xml` |
| Primary key in the edition | Project UUID (`xml:id`) |
| Foreign key in texts | `@key` on mentions → project UUID only |
| External authority PK | `<idno type="CBDB">` etc. |
| User-specific synonym | `<idno type="ljb-central" subtype="…">` |
| ETL / sync job | Bridge: Link / Promote / Absorb |

---

## File layout (illustrative)

```
# Personal (anywhere; often cloud-synced)
~/LJB-entities/                         ← App Settings entity DB folder
├── entities.xml                        ← central (sequential ids)
├── entity-projects.json                ← registry (may evolve)
├── authority-packs/
└── authority-databases/

# Shared edition (Git / Dropbox) — not required to nest under central
~/editions/han-commentary/
├── jean-baptiste.project.json          ← entityDatabaseId = project DB fingerprint
├── entities.xml                        ← project (UUID ids + ljb-central mappings)
├── chapter1.xml                        ← @key = project UUIDs only
├── chapter2.xml
└── .ljb/                               ← gitignore; decision log; project history
```

---

## Migration from today’s either/or

Today: `entityStore: "central" | "project"` and mentions keyed into whichever file is active.

Target: projects that participate in this model always have project `entities.xml`; central is always available for bridge operations.

Suggested migration paths (product copy TBD):

1. **Was project-only** — already has project file; mint `userStableId` if needed; offer bulk “Promote unlinked to central” (optional).
2. **Was central-only with `@key`s pointing at central** — on first open under the new model: create project `entities.xml`; **Import** entities referenced by corpus from central (authority-preserving, new project UUIDs); write `ljb-central` mappings; **remap** corpus `@key`s from old sequential ids → new UUIDs. Reuse existing import + `rewriteMentionKeys` / `applyKeyRemap` machinery.
3. **Legacy sequential project ids** — grandfathered (see Open questions): allow mixed ids until Absorb/edit touches them, rather than a one-shot bulk rewrite of a live corpus.

Fingerprint / mismatch recovery remains oriented at the **project** database id stored in project JSON.

---

## UI sketch (minimal)

Not a full viewer redesign (see [`entity-database-viewer-planning.md`](entity-database-viewer-planning.md)); bridge needs:

1. **Project settings** — remove “central vs project” as mutually exclusive for new projects; explain “edition DB (shared) + personal DB (optional link).”
2. **Bridge inbox** (dialog or sidebar section) — counts of unlinked / broken mappings; actions Link, Promote, Absorb.
3. **Disambiguation flow** — when resolving a mention: create/select **project** entity (UUID); optionally “also link to my central” if authority match exists.
4. **Time Machine** — keep two tabs; add short copy: rollbacks do not cross the bridge automatically; orphan scan after restore.
5. **Collaboration banner** (once) — “This project’s entities.xml is shared. Your central database stays private. Entity additions can conflict like any shared file — if Git flags entities.xml, keep both entries and re-open the project.”

---

## Implementation phases (proposed)

### Phase A — Data model & ids

- [ ] Scaffold / validate project entities with UUID `xml:id` minting (keep sequential minting for central).
- [ ] `ljb-central` `<idno>` read/write helpers; `userStableId` persisted inside the central entity DB folder (not userData — see §Mapping).
- [ ] Document TEI shape in `entities.ts` comments + this doc; tests for round-trip.
- [ ] Exclude project `entities.xml` from corpus ops (already required).

### Phase B — Always-on project DB + migration

- [ ] New projects always create project `entities.xml`.
- [ ] Migration wizard: central-only → project file + remap `@key` + write mappings.
- [ ] Project JSON / settings copy update; retire exclusive `entityStore` for the happy path (keep read compatibility).
- [ ] Registry fix: `entity-projects.json` entries keyed by stable `projectId` instead of raw absolute path, so a root unreachable from the current machine isn't treated as gone (see "Registry fragility").

### Phase C — Bridge operations

- [ ] Link / Promote / Absorb APIs (authority-first matching).
- [ ] Absorb reuses `mergeEntities` + corpus key remap across project tree.
- [ ] Bridge inbox on project open + manual entry point.
- [ ] Seed-from-central when tagging: if central knows CBDB X, create project entity + mapping instead of a duplicate.

### Phase D — Staleness & rollback hooks

- [ ] Orphan `@key` scan after project DB or corpus rollback.
- [ ] Broken `ljb-central` cleanup after central rollback.
- [ ] Inbox badges for “unlinked” / “broken link.”

### Phase E — Pedagogy & docs

- [ ] Workshop chapter updates: dual DB, share project folder, sequential entity-file edits, Git/cloud.
- [ ] Cross-links from `Auto-tagging.md` Deferred (replace “multi-machine concurrent” note with this plan’s constraints).

---

## Open questions

Resolved since the first draft (see inline **locked** notes above): UUID form (kind-prefixed, §Id schemes), `userStableId` storage (central DB folder, §Mapping), and `ljb-central` privacy (kept in the shared file, §Mapping). Registry redesign is no longer "open" either — see "Registry fragility" above, sequenced into Phase A/B.

1. **Force UUID migration** for existing project sequential ids, or grandfather until edit? — leaning grandfather: a bulk remap of a live corpus is exactly the kind of operation that shouldn't run unsupervised the first time this ships; let Absorb/edit upgrade ids opportunistically instead.
2. **Authority packs** — remain beside central folder (per-machine download) so project sync stays small?

---

## Deferred (explicitly not this plan)

- LJB-hosted or third-party SQL entity server.
- Concurrent multi-writer merge of the same `entities.xml` (CRDT/OT).
- Real-time co-editing (Yjs) of entity records.
- Standalone merge of two **central** files with no project context (nice-to-have later; authority-dedupe import can reuse Promote logic).
- Replacing XML with SQLite as source of truth (optional runtime index remains a separate deferred idea in `Auto-tagging.md`).

---

## Relationship to existing code

| Area | Today | Under this plan |
|------|--------|-----------------|
| `entityStoreResolve.ts` | `central` XOR `project` | Resolve **project** file for `@key`; central always available for bridge |
| `entities.ts` / `nextEntityId` | Sequential per kind | Sequential for central; UUID mint for project |
| `mergeEntities` / `applyKeyRemap` | Merge inside one file + remap corpus | Become **Absorb** (project side); Link/Promote are new |
| `entityDatabaseCheck.ts` | Fingerprint vs attached DB | Fingerprint vs **project** DB |
| Time Machine | Project vs central tabs | Unchanged storage split; add orphan/bridge warnings |
| Workshop ch. 9 | Sync whole workspace | Sync **project** for collab; central optional personal sync |

---

## Success criteria

- A solo user can keep a lifelong central DB and many projects without forcing a root-folder layout.
- Two users can clone/sync one project folder, resolve mentions against the **same** project `entities.xml`, and each Link/Promote into their own central DB without colliding on ids.
- Corpus `@key`s never depend on another user’s central file.
- Rollback of central or project DB is possible independently, with clear orphan/mapping recovery.
- No entity SQL server to operate.
