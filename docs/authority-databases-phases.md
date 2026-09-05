# Authority databases (CBDB + DILA) — Work Phases

**Status (2026-08-02):** **Mostly shipped** — A0–A3 and pack lifecycle live; A5/A6 reference lookup in use. Date-filtered tag-bomb memory profiling is now substantially improved; an unfiltered/full-pack profile remains. Companion to [authority-databases-planning.md](authority-databases-planning.md).

## Phase A0 — Language codes & gating

Smallest piece, unblocks everything else.

**Decide first:**

- [x] Code list: BCP-47 (`zh-Hant`, `zh-Hans`, `en`, `fr`, …) — do we distinguish Hant/Hans for gating, or gate on primary subtag `zh`? DPM: yes.
- [x] Where the setting lives: project schema? translation-pane language? both feeding one "project languages" set? DPM: project schema and translation pane both use languages, both will use fixed codes, one for the source documents, one for translation languages. Tagging and disambiguation only matter for the source document, its language is determined at the project level.
- [x] Migration for existing projects with free-text language values. DPM: if there's no language, reopen the project settings before allowing the user to proceed. Language is mandatory.

**Prepare:**

- [x] Replace free-text language entry with a fixed-code picker.
- [x] A single `isChineseEnabled(project)` predicate the rest of the feature keys off.

**Done when:** a project can declare Chinese via a fixed code, and non-Chinese projects see none of the new UI.

**Status (2026-07-04):** built.

- Fixed code list (BCP-47, incl. `zh-Hant`/`zh-Hans`/`lzh` Literary Chinese) lives in `packages/cwrc-leafwriter/src/utilities/languageCodes.ts`; light windows import it via the `@cwrc/leafwriter/languageCodes` alias (webpack + tsconfig) so native dialogs don't pull in the editor bundle.
- Project settings dialog (`NativeProjectMetadataPage`): "Source language" is now a required select (legacy free-text values stay selectable, marked "(legacy)"); Save buttons disable while it's empty. Translation languages are added from the same fixed list (label auto-filled); the free-text code/label inputs are gone.
- `normalizeLanguageIdent` now preserves hyphenated BCP-47 tags with canonical case (`zh-hant` → `zh-Hant`) instead of truncating them.
- Gate: `apps/commons/src/desktop/projectLanguage.ts` — `getProjectSourceLanguage(bundle)` / `isChineseEnabled(bundle)` (accepts `zh*`, `lzh`, legacy `chi`/`zho`). Orlando projects are exempt (no language field).
- Migration: `completeProjectOnboarding` blocks project open until a source language is saved (reopens the settings dialog; cancel = project doesn't open).

## Phase A1 — Download manager

**Decide first:**

- [x] Storage location: repo-level `databases/` vs. per-user app-data dir (desktop). Web app: probably unsupported at first — confirm desktop-only for v1. DPM: this will be alongside the user's central database wherever the user chose to install that. BTW, we didn't go through this while developping, so let's use test_project as our main folder, and corpus_a as our project. I've changed names already.
- [x] Download UX: settings section vs. prompt-on-first-Chinese-project. DPM: prompt on first Chinese project.

**Prepare:**

- [ ] Fetcher: CBDB zip from the HuggingFace URL (manifest JSON already gives URL + sha256), DILA person/place/districts XML from `DILA-edu/Authority-Databases` (pin a commit; record it in our manifest).
- [ ] Checksum verification, unzip, and a per-source manifest file (`source, version/date, sha256, upstream URL, installedAt`).
- [ ] Presence + valid-manifest check = source availability; nothing else in the app looks at the raw files.

**Done when:** from a Chinese project, the user can fetch both sources; a corrupted or missing file simply makes the source unavailable.

**Status (2026-07-04):** built.

- `apps/desktop/src/authorityDatabases.ts` (electron-free, unit-tested): source specs — CBDB zip pinned to the HuggingFace 20260627 release (sha256-verified sqlite, extracted via JSZip stream), DILA person/place/districts XML pinned to commit `385e3f55` (2026-06-30) on `DILA-edu/Authority-Databases`. Files download to `<entityDbFolder>/authority-databases/` under temp names, rename into place after hashing, manifest (`<id>.manifest.json`: version, per-file sha256/bytes/upstream URL, installedAt) written last — a crashed download never reads as installed.
- Availability = manifest parses + every listed file present with recorded size (`getAuthorityStatuses`); no other code touches the raw files.
- IPC: `authorityDb:statuses`, `authorityDb:download` (streams progress events, throttled; system notification on success/failure; concurrent-download guard), `authorityDb:promptDownload` (native dialog; decline is remembered via `download-declined.json` marker so the user isn't nagged — the A4 panel can still trigger downloads).
- Prompt-on-first-Chinese-project: `maybeOfferAuthorityDatabases` in commons, called fire-and-forget at the end of `completeProjectOnboarding` — project open is never blocked; missing-source check uses the same statuses IPC. Shared renderer types in `apps/commons/src/desktop/authorityDbTypes.ts`.
- Not yet exercised end-to-end with the full 600 MB CBDB download (URLs verified reachable; DILA files are the ones already in `databases/`).

## Phase A2 — Compile step — **partial (pre-compiled packs, 2026-07-05)**

Compile runs in the sibling [`authority extraction`](../../authority%20extraction/) repo (`npm run compile:cbdb`, `compile:dila`). Grognard **loads** NDJSON from `<entityDbFolder>/authority-packs/`.

**Built:**

- [x] `packLoader.ts`, `packPaths.ts`, `runAuthorityTagBomb` on `AutoTaggingSession`
- [x] Desktop IPC: `authorityPack:statuses`, `authorityPack:read`, `authorityPack:installFrom`
- [x] Dialog: **Tag from authority packs (CBDB / DILA)** with source checkboxes
- [x] CBDB offices → `roleName`; `kind: office` on candidates (standoff `office` entity deferred to 4b)
- [x] `scripts/sync-authority-packs.mjs` — copy compiled packs into entity DB folder

**Install packs (dev):**

```bash
cd authority\ extraction && npm run compile:cbdb && npm run compile:dila
cd leaf-writer && node scripts/sync-authority-packs.mjs /path/to/entityDbFolder
```

**Still to do:**

- [x] Year-range slider + hide undated (A4)
- [ ] In-app compile from downloaded sqlite/XML — **superseded**: GitHub release packs + optional raw reference ([authority-data-lifecycle.md](authority-data-lifecycle.md))
- [x] Date-filtered memory profile: tag-bomb peak fell from about 1.1 GB to 236 MB after uncaching one-shot pack reads
- [ ] Progress / memory profile on full 659k-person load without a date filter

**Done when:** each downloaded source yields NDJSON artifacts; a golden test compiles a fixture slice of each source and snapshots the candidates (including clue lines). → **Met via authority extraction tests + packLoader tests.**

## Phase A3 — Matcher integration at scale

**Status (2026-07-05):** built for v1 tag bomb path.

**Decide first:**

- [x] Memory budget: stream NDJSON + build index incrementally (no 659k `push()`); date filter **before** index build.

**Prepare:**

- [x] Loader: seed index `Map<tag+surface, candidates[]>`; overlap merge **only** when DILA `idno type="CBDB"` crosswalk links to CBDB (`authorityOverlap.ts`). Same string without crosswalk → separate suggestions; user may link manually in disambiguation (4b).
- [x] Date-range filter at load time (`candidateIntersectsYearRange`).
- [x] Wire into seed matcher; suggestions carry `sourceDetail` + `rationale` clue.

**Still to do:**

- [x] Formal filtered memory check in the desktop app: a cutoff through 530 CE peaked at about 236 MB after the one-shot read path was added
- [ ] Formal full-pack memory/time profile without a date filter

**Done when:** with CBDB persons + DILA persons both selected and a date range set, a real document produces deduped suggestions with correct clue lines, at acceptable load time and memory. → **Met in app + opt-in harness (`authorityTagBombHarness.live.test`).**

## Phase A4 — Authority panel UI

**Status (2026-07-05):** partial.

**Decide first:**

- [x] Slider design: single year-range slider with dynasty presets as labeled stops (Eastern Han, Tang, Song, Ming–Qing).

**Prepare:**

- [x] Authority dialog: checkbox per pack, date slider, hide undated, install-from-source.
- [x] Review panel: source badge (`CBDB+DILA`), clue line (`rationale`); DILA disambiguation in clue when compiled.
- [x] Post-run notice: per-pack entry counts + match count.
- [x] Persist source + date selection per project (`autoTaggingAuthority` in project JSON).

**Done when:** the full flow — pick sources, set period, run, review with clues — works end to end and unavailable sources are absent (not greyed). → **Mostly met; memory profiling remains.**

## Phase A5 — Update checking & lifecycle

**Spec:** [authority-data-lifecycle.md](authority-data-lifecycle.md) (revised 2026-07-05) — **two-tier model**: tagging packs from **GitHub releases**, reference databases from **official upstream**.

**Decision (2026-07-05):** Do **not** compile on user machines for CBDB/DILA in production. GitHub Actions builds NDJSON and publishes release tarballs; Grognard downloads binaries. Raw sqlite/XML remains a **separate optional tier** for entity enrichment (posting history, full TEI, coords, etc.) — not for tag matching.

**Built (spike, 2026-07-05):**

- [x] `lifecycle.json` schema + `authorityLifecycle:*` IPC (get, setEnabled, update, progress, prompt)
- [x] Settings → Authorities: offline toggle, update, open folder, disable confirm
- [x] Onboarding wired to lifecycle enable flag
- [x] In-app compile spike (`authorityCompile.ts`) — **dev fallback only**; replace with pack fetch

**Prepare (build next — in order):**

1. [x] **C3/D3** — GitHub Actions in `authoritypacks`: compile → tarball + `packs-index.json`
2. [x] Grognard pack fetcher: `authorityPackRegistry.ts` — download bundle from GitHub release assets, verify sha256, extract
3. [x] **Reference data** checkbox (default off): keep A1 fetcher for `authority-databases/` when enabled
4. [x] **Look for Updates** (menu) + background poll (same 4h cadence as app updater): force-checks authority packs and plugins; OS notification when available
5. [x] “Update available” via per-bundle sha256; Settings → Update now / Look for Updates snackbar refreshes packs (+ reference if enabled)
6. [ ] Disable: delete or keep both tiers

**Done when:** per [authority-data-lifecycle.md](authority-data-lifecycle.md) exit criteria — packs from GitHub, reference optional, no terminal for normal users.

## Phase A6 — Reference lookup (disambiguation enrichment)

**Spec:** [authority-data-lifecycle.md](authority-data-lifecycle.md) § two tiers.

**Purpose:** When linking or backfilling a person with a CBDB / DILA / Norbert idno, pull rich fields from the reference tier and write them into the user entity database.

**Done (2026-08-01):**

- [x] `authorityRef:lookup(source, authorityId)` IPC — targeted sqlite (CBDB slim / Norbert) or TEI slice (DILA)
- [x] Field set v1: typed names, nationality, origin/籍貫, appointments; Norbert noble titles from `person_nt`
- [x] Backfill / link callers pass `lookupAuthorityRef`; reference wins over pack when both present
- [x] Graceful degrade: pack-only when reference tier not installed
- [ ] Disambiguation detail pane UI (optional follow-up; enrichment already writes on accept/backfill)

**Reference artifacts:**

| File                                  | Origin                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `cbdb-person.sqlite3`                 | Stripped from full CBDB (person/names/dynasty/addr/postings/offices only) |
| `norbert.sqlite3`                     | Public allowlisted SQL → sqlite + `dynasty_labels`                        |
| `dila-person.xml` (+ place/districts) | DILA Open Content / GitHub mirror                                         |

## Phase H — CHGIS

Historical place pack + **local-only** delivery (Dataverse EULA — no GitHub redistribution). Compile track in `authority extraction` (`chgis/compile.mjs`); Grognard **Settings → Authorities → Install from download…** (`authorityChgis.ts`).

## Deferred / future

- Wikipedia/VIAF/Wikidata: not a match source at tag time — use **authority packs** built in the [`authority extraction`](../../authority%20extraction/) repo (see [authority-extraction.md](authority-extraction.md), [phases.md](../../authority%20extraction/docs/phases.md)). VIAF/Wikidata idnos remain Phase 4b reconciliation when minting entities.
- **VIAF↔Wikidata precompiled concordance** — **Grognard wired (2026-08-02):** disambiguation loads pack id `wikidata-viaf-concordance` (`wikidata/viaf-wikidata-concordance.ndjson`) and enriches live candidates before collapse; pack match rows also emit `metadata.crosswalk` VIAF/Wikidata ids. Regex scraping of LINCS descriptions remains a fallback. **Still to publish:** re-extract Wikidata person packs so raw rows carry P214, recompile, run `npm run wikidata:viaf-concordance` in the authority-extraction repo, and ship the NDJSON in the pack bundle (instructions: [authority extraction README](../../authority%20extraction/README.md)).
- Web-app support (databases are desktop-filesystem for now).
- DILA `ana` values other than `historical` — flag mythical/uncertain in the clue?
- Other authority sources behind the same source-manifest interface (Korean sets à la Markus, local gazetteers).
