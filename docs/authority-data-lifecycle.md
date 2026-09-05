# Authority data lifecycle (CBDB + DILA + Norbert + CHGIS + NDL)

**Status:** Spec (revised 2026-08-01) — two-tier model; **CI-first pack delivery** for normal users; **A6 reference lookup** wired for person enrichment. Profiles: **`chinese`**, **`japanese`**, **`tibetan`**.

**Related:** [authority-databases-phases.md](authority-databases-phases.md) (tracks A0–A6), [authority-databases-planning.md](authority-databases-planning.md) (field detail), [authority extraction/docs/phases.md](../../authority%20extraction/docs/phases.md) (compile + GitHub publish).

**Scope:** **CBDB**, **DILA**, **Norbert**, and **CHGIS** under the Chinese profile; **NDL + Wikidata-ja** under Japanese; Wikidata-focused packs under Tibetan. CHGIS is a Tier 1 (pre-compiled pack) source folded into the `chinese` profile bundle; see [CHGIS](#chgis).

**Plugins (related, not packs):** Accepting the **Japanese** first-project download also installs and enables **Sanmiao** via the `cjk-dates` plugin (`ensureLanguagePlugins` in Commons). Chinese projects still use the Chinese assets dialog for plugins (Norbert, `cjk-dates`, …).

---

## Problem

Tag bomb and disambiguation need **fast, versioned tagging packs**, but scholars also need the **richer person record** when tying authorities to the user entity database (typed names, nationality, 籍貫, appointments, Norbert noble titles, etc.). Those are different jobs and should not be conflated.

**Goal:** One user-controlled lifecycle: enable → install packs + optional reference data → use → update → (optional) disable and delete.

---

## Two tiers (decision 2026-07-05; reference shipping revised 2026-08-01)

| Tier                    | Path                     | Source                                                                                                               | Purpose                                                                                       |
| ----------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Tagging packs**       | `…/authority-packs/`     | **GitHub `authoritypacks` releases** (NDJSON + manifest)                                                             | Tag bomb; offline disambiguation **shortlist**                                                |
| **Reference databases** | `…/authority-databases/` | **GitHub** co-ships **Norbert sqlite + stripped CBDB person sqlite**; **DILA** TEI from Open Content / GitHub mirror | Rich lookup when minting/enriching — names, nationality, origin, appointments, Norbert titles |

**Not done:** merging CBDB + Norbert + DILA into one sqlite. Each source keeps its native (or slimmed) format; `authorityRef:lookup(source, id)` knows how to query each.

```text
GitHub Actions
        ↓
Tagging: authority-packs-*.tar.gz + packs-index.json
Reference: authority-reference-person-*.zip + reference-index.json
        ↓
Grognard → authority-packs/          ← tag bomb + shortlist
Grognard → authority-databases/      ← cbdb-person.sqlite3, norbert.sqlite3, dila-*.xml
        ↓
authorityRef:lookup(source, id) ← A6
        ↓
User entity SQLite (names, nationality, origin, appointments, noble titles)
```

**Runtime rules:**

| Feature                              | Reads                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Tag bomb                             | `authority-packs/` only (never SQL/XML)                                                             |
| Offline disambiguation shortlist     | `authority-packs/` only                                                                             |
| Link / backfill enrichment           | Prefer `authorityRef:lookup` when reference installed; else pack metadata; Wikidata may enrich live |
| Online reconcile (VIAF, Wikidata, …) | LINCS / live APIs — separate from both tiers                                                        |

### What Grognard reads when

| Need                             | Pack NDJSON                                     | Reference DB | Live Wikidata     |
| -------------------------------- | ----------------------------------------------- | ------------ | ----------------- |
| Tag-bomb seeds (`searchStrings`) | Yes                                             | No           | No                |
| Typed names / 姓名字 on entity   | Prefer reference; else pack                     | Yes          | Fallback          |
| Nationality, 籍貫, appointments  | Prefer reference; else pack                     | Yes          | Nationality / PoB |
| Norbert noble titles             | Pack wiki-nt index and/or reference `person_nt` | Yes          | —                 |

---

## Licenses (distribution constraints)

| Source      | License                                                               | Tagging packs (GitHub releases)                          | Reference download                                                                                                                            |
| ----------- | --------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **CBDB**    | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | **OK** — attribute CBDB; release derivatives under NC-SA | **Stripped person sqlite** in `authority-reference-person-*.zip` (not full HuggingFace dump)                                                  |
| **Norbert** | internal-derived-public                                               | **OK** — attribution in manifest                         | Same reference zip (`norbert.sqlite3`)                                                                                                        |
| **DILA**    | CC-BY-SA 3.0                                                          | **OK** — attribute DILA                                  | Browse [Open Content Downloads](https://authority.dila.edu.tw/docs/open_content/download.php); Grognard fetches the GitHub TEI mirror of that data |
| **CHGIS**   | Academic EULA — no standalone redistribution                          | **OK as bundled derivative** in chinese pack             | Local Dataverse compile only                                                                                                                  |

Pack manifests must record `license` accurately (CBDB: `CC-BY-NC-SA-4.0`, not vague “academic terms”). Settings UI shows attribution strings.

---

## Where it lives in the UI

**Application Settings → Authorities** (desktop only).

**“Offline Chinese authorities (CBDB + DILA)”** block:

| Control                            | Behavior                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Enable** (master toggle)         | Download tagging packs from the GitHub `authoritypacks` repo; optionally download reference databases from upstream. Weekly update checks. |
| **Reference databases** (checkbox) | Fetch slim CBDB + Norbert from GitHub reference zip; fetch DILA TEI (Open Content mirror). Turn off to save disk if user only tags.        |
| **Status**                         | Per tier: pack version, reference version, disk use, last check, update available / downloading / error.                                   |
| **Update now**                     | Refresh packs from GitHub; refresh reference data from upstream if enabled.                                                                |
| **Open folder**                    | Reveal `<entityDbFolder>` in the file manager.                                                                                             |

**Not in scope:** Entity Lookups bubble order (VIAF, Wikidata) — online lookup at mint time (Phase 4b). Tag bomb source checkboxes stay in the auto-tag dialog.

**First-project prompt:** Wire to the same enable flag. On accept: enable + install packs (+ reference data if checkbox on). **Japanese** accept also installs Sanmiao (`cjk-dates`). Chinese projects may get a separate assets dialog (packs / plugins / map tiles).

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

`lifecycle.json` stays under `authority-databases/` (or move to `.grognard/` later if reference tier is omitted).

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

| Channel                             | Signal                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| **Pack registry**                   | Bundle `packBundleVersion` / per-file sha256 vs local `packs.manifest.json`            |
| **Reference upstream** (if enabled) | CBDB HuggingFace release; DILA GitHub commit vs local manifests                        |
| **Policy only**                     | App ships new `compilePolicyVersion` → new pack bundle on registry, no upstream change |

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
4. Publish: commit generated `dist/` to the `authoritypacks` repo or attach GitHub Release assets with stable URLs for Grognard manifest check.

Grognard desktop app **only downloads** this artifact for tier 1. Compile scripts remain in `authority extraction` for CI and local dev.

---

## IPC / API (desktop)

| Channel                         | Purpose                                                   | Status                                |
| ------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| `authorityLifecycle:get`        | Status for both tiers                                     | built (partial — local compile spike) |
| `authorityLifecycle:setEnabled` | Enable/disable + optional delete                          | built                                 |
| `authorityLifecycle:update`     | Manual update                                             | built (needs pivot to pack fetch)     |
| `authorityLifecycle:onProgress` | Download progress                                         | built                                 |
| `authorityPack:read`            | Tag bomb reads NDJSON                                     | built                                 |
| `authorityDb:download`          | Reference tier fetch                                      | built (A1)                            |
| `authorityRef:lookup`           | `(source, authorityId) → JSON` detail from raw sqlite/XML | **planned (A6)**                      |

---

## CHGIS

Historical China **places** — complements CBDB places and DILA. See [authority-packs-planning.md](authority-packs-planning.md) §4.5.

| Aspect    | Status                                                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pack      | `authority-packs/chgis/places.ndjson`, compiled in `authority extraction` and shipped as part of the `chinese` profile bundle                                                                                                                 |
| Delivery  | **Tier 1, pre-compiled** — same GitHub-release pack registry as CBDB/DILA/Wikidata. Compiled once locally by a maintainer per CHGIS version bump and checked into `authority extraction` via Git LFS (not compiled on the end user's machine) |
| Crosswalk | CBDB `CHGIS_PT_ID` (exact-id match) and DILA (name+geo fuzzy match); both crosswalks are built once locally and checked in alongside the pack — see `authority extraction/chgis/README.md`                                                    |
| UI        | No dedicated CHGIS UI — folded into the generic offline-authorities block (`DesktopOfflineAuthorities`) and its manifest-driven attributions disclosure, same as every other pack source                                                      |

---

## What consumes what

| Feature                             | Tier 1 (packs)      | Tier 2 (reference)         | Online   |
| ----------------------------------- | ------------------- | -------------------------- | -------- |
| Tag bomb                            | ✓                   | —                          | —        |
| Disambiguation shortlist            | ✓                   | —                          | —        |
| Disambiguation detail pane          | id + clue from pack | full record lookup         | LINCS    |
| `entities.xml` `<idno>`             | id from pack        | —                          | —        |
| `entities.xml` authority-cache note | minimal             | rich fields from reference | optional |

---

## Implementation phases

| Step | Track | Deliverable                                                        | Status                   |
| ---- | ----- | ------------------------------------------------------------------ | ------------------------ |
| 1    | A5    | This spec; lifecycle IPC + Settings UI (spike)                     | partial                  |
| 2    | C3/D3 | GitHub Actions → publish pack bundle + `packs-index.json`          | done                     |
| 3    | A5    | Grognard: fetch packs from GitHub contents (`authorityPackRegistry.ts`) | done                     |
| 4    | A5    | Reference-data checkbox + keep A1 fetcher for tier 2               | done / in use            |
| 5    | A6    | `authorityRef:lookup` for disambiguation / entity enrichment       | done (person enrichment) |
| 6    | D1    | DILA recompile (D0 `<note>`/`<add>` variants); bump policy         | planned                  |
| 7    | H     | CHGIS compile + fold into `chinese` Tier 1 pack bundle             | done                     |

**Exit criteria:** User enables once; packs install from GitHub without terminal; reference data optional; tag bomb works; update offers new pack bundle; disambiguation can show rich CBDB/DILA detail from local reference; disable + delete reclaims disk.

---

## Non-goals (v1)

- Web app (no filesystem).
- Auto-update without user confirmation.
- Standalone redistribution of the raw CHGIS dataset itself (only a bundled derivative, folded into the multi-source `chinese` pack, is in scope).
- CBETA corpus updates.
- In-app editing of compile rules.

---

## Open questions

- [ ] Pack bundle format: one tarball vs per-source files.
- [ ] CBDB API as online fallback when reference sqlite missing — defer to 4b.
