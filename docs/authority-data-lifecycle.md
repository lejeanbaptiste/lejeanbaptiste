# Authority data lifecycle (CBDB + DILA)

**Status:** Spec (revised 2026-07-05) — two-tier model; **CI-first pack delivery** for normal users.

**Related:** [authority-databases-phases.md](authority-databases-phases.md) (tracks A0–A6), [authority-databases-planning.md](authority-databases-planning.md) (field detail), [authority extraction/docs/phases.md](../../authority%20extraction/docs/phases.md) (compile + GitHub publish).

**Scope (v1):** **CBDB** and **DILA**. **CHGIS** is planned as a third offline place source — see [CHGIS (planned)](#chgis-planned). These are Buddhist/Chinese **authority databases**, not CBETA corpus files.

---

## Problem

Tag bomb and disambiguation need **fast, versioned tagging packs**, but scholars also need the **full relational / TEI record** when tying authorities to `entities.xml` (posting history, kinship, coordinates, DILA notes, crosswalks, etc.). Those are different jobs and should not be conflated.

**Goal:** One user-controlled lifecycle: enable → install packs + optional reference data → use → update → (optional) disable and delete.

---

## Two tiers (decision 2026-07-05)

| Tier | Path | Source | Purpose |
|------|------|--------|---------|
| **Tagging packs** | `<entityDbFolder>/authority-packs/` | **GitHub repo + Actions** (pre-compiled NDJSON + manifest) | Tag bomb; offline disambiguation **shortlist** (names, ids, dynasty, dates, clue lines) |
| **Reference databases** | `<entityDbFolder>/authority-databases/` | **Official upstream** (HuggingFace CBDB, DILA GitHub, etc.) | Rich lookup when minting/enriching project entities — posting history, full TEI, coords, `CHGIS_PT_ID`, etc. |

```text
GitHub Actions (compile on tag / upstream pin change)
        ↓
Pack registry (manifest + NDJSON tarballs, sha256)
        ↓
LJB downloads → authority-packs/          ← tag bomb + candidate shortlist

Official upstream (HuggingFace / GitHub / Dataverse)
        ↓
LJB downloads → authority-databases/      ← reference layer (optional but recommended)
        ↓
authorityRef:lookup(source, id)         ← disambiguation detail pane (A6, planned)
        ↓
entities.xml (<idno> + optional authority-cache note)
```

**Why both:** Compiled packs are **lossy by design** — they keep only what string matching and one-line clues need. CBDB sqlite alone has dozens of tables; DILA XML has full `<note>`, `<placeOfOrigin>`, district hierarchy. Users building a serious entity database will want the reference layer even when packs come from GitHub.

**Runtime rules:**

| Feature | Reads |
|---------|--------|
| Tag bomb | `authority-packs/` only |
| Offline disambiguation shortlist | `authority-packs/` only |
| Disambiguation detail / entity enrichment | `authority-databases/` (via `authorityRef:lookup`, planned) + optional online LINCS |
| Online reconcile (VIAF, Wikidata, …) | LINCS API — separate from both tiers |

Nothing in the **matcher** reads raw sqlite/XML. The **disambiguation panel** may query raw on demand by `authorityId`.

---

## Licenses (distribution constraints)

| Source | License | Tagging packs (GitHub releases) | Raw reference download |
|--------|---------|------------------------|-------------------------|
| **CBDB** | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | **OK** — attribute CBDB; release derivatives under NC-SA | User fetches from HuggingFace / Harvard (same license) |
| **DILA** | CC-BY-SA 3.0 | **OK** — attribute DILA; share-alike on derivatives | User fetches from DILA GitHub |
| **CHGIS** | Academic EULA — **no redistribution** | **Not OK** without permission | User fetches from [Harvard Dataverse](https://dataverse.harvard.edu/dataverse/chgis_v6); compile locally only |

Pack manifests must record `license` accurately (CBDB: `CC-BY-NC-SA-4.0`, not vague “academic terms”). Settings UI shows attribution strings.

---

## Where it lives in the UI

**Application Settings → Authorities** (desktop only).

**“Offline Chinese authorities (CBDB + DILA)”** block:

| Control | Behavior |
|---------|----------|
| **Enable** (master toggle) | Download tagging packs from the GitHub `authoritypacks` repo; optionally download reference databases from upstream. Weekly update checks. |
| **Reference databases** (checkbox, default **on**) | Also fetch raw CBDB sqlite + DILA XML into `authority-databases/` for disambiguation enrichment. Can turn off to save ~685 MB if user only tags. |
| **Status** | Per tier: pack version, reference version, disk use, last check, update available / downloading / error. |
| **Update now** | Refresh packs from GitHub; refresh reference data from upstream if enabled. |
| **Open folder** | Reveal `<entityDbFolder>` in the file manager. |

**Not in scope:** Entity Lookups bubble order (VIAF, Wikidata) — online lookup at mint time (Phase 4b). Tag bomb source checkboxes stay in the auto-tag dialog.

**First-project prompt:** Wire to the same enable flag. On accept: enable + install packs (+ reference data if checkbox on).

---

## Storage layout

```
<entityDbFolder>/
  entities.xml
  authority-packs/              # Tier 1 — from GitHub (tagging binaries)
    cbdb/
      manifest.json             # policy.version, license, sha256, upstream pin
      persons.ndjson
      places.ndjson
      offices.ndjson
    dila/
      manifest.json
      persons.ndjson
      places.ndjson
  authority-databases/          # Tier 2 — from official upstream (reference)
    lifecycle.json              # app prefs (see below)
    packs.manifest.json         # last-installed pack bundle from GitHub (version, sha256, url)
    cbdb.manifest.json
    cbdb.sqlite3
    dila.manifest.json
    dila-person.xml
    dila-place.xml
    dila-districts.xml
```

`lifecycle.json` stays under `authority-databases/` (or move to `.ljb/` later if reference tier is omitted).

---

## Lifecycle preference file

`authority-databases/lifecycle.json`:

```json
{
  "version": 1,
  "enabled": true,
  "referenceDataEnabled": true,
  "lastCheckAt": "2026-07-05T10:00:00.000Z",
  "packBundleVersion": "2026-07-05",
  "compilePolicyVersion": "2026-07-05",
  "declinedFirstPrompt": false
}
```

- **`referenceDataEnabled`** — when true, also maintain raw CBDB/DILA under `authority-databases/`.
- **`packBundleVersion`** — matches the GitHub-published bundle (not necessarily the same as upstream CBDB release date).
- **`compilePolicyVersion`** — matches `policy.version` in pack manifests.

---

## Enable

When the user turns **Enable** on:

1. **Validate** entity DB folder (`entities.xml` at root).
2. **Download tagging packs** from the **pack registry** (GitHub contents, GitHub Release assets, or HuggingFace dataset you control):
   - Fetch bundle manifest → compare version / sha256.
   - Download tarball(s) → verify → extract to `authority-packs.new/` → atomic rename → `authority-packs/`.
3. **If reference data enabled:** download missing/outdated **raw** sources (existing A1 fetcher):
   - CBDB: HuggingFace zip → sha256 → sqlite.
   - DILA: pinned GitHub commit → three XML files.
4. **Set** `lifecycle.json` → `enabled: true`.
5. **Notify** on success. On pack failure, leave previous packs in place.

**Dev / air-gap fallback:** `sync-authority-packs.mjs` or local compile from raw (`authority extraction` repo) — not the default user path.

**Timing (order of magnitude):** Pack download ~100–300 MB (network-bound, no compile wait). Reference data ~685 MB additional if enabled.

---

## Update

**When:** ≤ once per week on app start (if `enabled` and online). Manual **Update now** anytime.

**Check two channels:**

| Channel | Signal |
|---------|--------|
| **Pack registry** | Bundle `packBundleVersion` / per-file sha256 vs local `packs.manifest.json` |
| **Reference upstream** (if enabled) | CBDB HuggingFace release; DILA GitHub commit vs local manifests |
| **Policy only** | App ships new `compilePolicyVersion` → new pack bundle on registry, no upstream change |

On user accept (never silent):

1. Download pack bundle → verify → atomic swap of `authority-packs/`.
2. If reference enabled and upstream newer → refresh raw files (A1 fetcher).
3. Bump `lifecycle.json` `lastCheckAt`.

**Session safety:** Do not replace packs mid tag-bomb review — queue or warn.

---

## Disable

Same as before: stop checks; confirm **Delete files** (both tiers) vs **Keep files** (disable updates only).

---

## GitHub pack registry (authority extraction)

**Decision (C3, 2026-07-05):** Pre-compiled packs built in **GitHub Actions**, not on user machines.

**Pipeline (sketch):**

1. Trigger: release tag, or manual pipeline when upstream pin / `policy.version` changes.
2. Job: `npm run compile:cbdb && npm run compile:dila` in `authority extraction`.
3. Artifact: `authority-packs-{version}.tar.gz` + root `packs-index.json` (version, policy, per-file sha256, licenses, attribution).
4. Publish: commit generated `dist/` to the `authoritypacks` repo or attach GitHub Release assets with stable URLs for LJB manifest check.

LJB desktop app **only downloads** this artifact for tier 1. Compile scripts remain in `authority extraction` for CI and local dev.

---

## IPC / API (desktop)

| Channel | Purpose | Status |
|---------|---------|--------|
| `authorityLifecycle:get` | Status for both tiers | built (partial — local compile spike) |
| `authorityLifecycle:setEnabled` | Enable/disable + optional delete | built |
| `authorityLifecycle:update` | Manual update | built (needs pivot to pack fetch) |
| `authorityLifecycle:onProgress` | Download progress | built |
| `authorityPack:read` | Tag bomb reads NDJSON | built |
| `authorityDb:download` | Reference tier fetch | built (A1) |
| `authorityRef:lookup` | `(source, authorityId) → JSON` detail from raw sqlite/XML | **planned (A6)** |

---

## CHGIS (planned)

Historical China **places** — complements CBDB places and DILA. See [authority-packs-planning.md](authority-packs-planning.md) §4.5.

| Aspect | Plan |
|--------|------|
| Pack | `authority-packs/chgis/places.ndjson` (compile in `authority extraction`) |
| Delivery | **Reference + compile on user machine only** — Dataverse EULA forbids redistributing compiled packs via GitHub |
| Crosswalk | CBDB `CHGIS_PT_ID`; overlap merge at match/disambiguation time |
| UI | Extend offline authorities block when CHGIS track ships |

---

## What consumes what

| Feature | Tier 1 (packs) | Tier 2 (reference) | Online |
|---------|------------------|----------------------|--------|
| Tag bomb | ✓ | — | — |
| Disambiguation shortlist | ✓ | — | — |
| Disambiguation detail pane | id + clue from pack | full record lookup | LINCS |
| `entities.xml` `<idno>` | id from pack | — | — |
| `entities.xml` authority-cache note | minimal | rich fields from reference | optional |

---

## Implementation phases

| Step | Track | Deliverable | Status |
|------|-------|-------------|--------|
| 1 | A5 | This spec; lifecycle IPC + Settings UI (spike) | partial |
| 2 | C3/D3 | GitHub Actions → publish pack bundle + `packs-index.json` | done |
| 3 | A5 | LJB: fetch packs from GitHub contents (`authorityPackRegistry.ts`) | done |
| 4 | A5 | Reference-data checkbox + keep A1 fetcher for tier 2 | planned |
| 5 | A6 | `authorityRef:lookup` for disambiguation / entity enrichment | planned |
| 6 | D1 | DILA recompile (D0 `<note>`/`<add>` variants); bump policy | planned |
| 7 | H | CHGIS compile + local-only lifecycle | planned |

**Exit criteria:** User enables once; packs install from GitHub without terminal; reference data optional; tag bomb works; update offers new pack bundle; disambiguation can show rich CBDB/DILA detail from local reference; disable + delete reclaims disk.

---

## Non-goals (v1)

- Web app (no filesystem).
- Auto-update without user confirmation.
- Redistributing CHGIS-derived packs from GitHub.
- CBETA corpus updates.
- In-app editing of compile rules.

---

## Open questions

- [ ] Pack bundle format: one tarball vs per-source files.
- [ ] CBDB API as online fallback when reference sqlite missing — defer to 4b.
