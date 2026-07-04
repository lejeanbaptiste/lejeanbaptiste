# Authority databases (CBDB + DILA) — Work Phases

Companion to [authority-databases-planning.md](authority-databases-planning.md).
This slots into the auto-tagging Phase 4a "authority" mode; the no-ids-at-tag-stage
rule holds throughout — authority ids travel on suggestions but nothing is minted
until Phase 4b.

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

## Phase A2 — Compile step

The heart of it: raw source → `AuthorityCandidate` NDJSON per source × kind
(`cbdb.person.ndjson`, `cbdb.place.ndjson`, `cbdb.office.ndjson`,
`dila.person.ndjson`, `dila.place.ndjson`). Runs after download and after an
accepted update; the matcher never touches SQLite/XML.

**Decide first:**
- [ ] SQLite access in-app: better-sqlite3 (native dep in Electron) vs. sql.js (wasm, slower but dependency-free). 550 MB file favours better-sqlite3.
- [ ] Include CBDB altname type 0 "Unknown" (45k strings)? Sample first.
- [ ] officeName candidate shape — carried-over open question (roleName at tag time, no entity?).

**Prepare:**
- [ ] CBDB extraction queries: BIOG_MAIN + DYNASTIES join; ALTNAME_DATA with the include/exclude type list from the planning doc; ADDR_CODES; OFFICE_CODES.
- [ ] DILA streaming XML parse (49 MB / 30 MB — SAX-style, not DOM): persName sets, birth/death year extraction, dynasty note → year range via DYNASTIES + alias table (北宋/南宋…), concise-note first clause, `idno` crosslinks; place records + districts.xml hierarchy for the clue.
- [ ] Shared rules: drop match strings ≤ 1 char, normalize whitespace/width per existing policy, build the one-line clue string at compile time.
- [ ] Progress UI — compiling 660k persons takes real seconds.

**Done when:** each downloaded source yields NDJSON artifacts; a golden test compiles a fixture slice of each source and snapshots the candidates (including clue lines).

## Phase A3 — Matcher integration at scale

**Decide first:**
- [ ] Memory budget: full CBDB persons ≈ 850k strings — profile the automaton; decide whether date filtering happens before automaton build (preferred) or per-match.

**Prepare:**
- [ ] Loader: selected sources → `Map<string, AuthorityCandidate[]>` (dedup by string; a hit fans out to all candidates sharing it, and cross-source overlap collapses).
- [ ] Date-range filter applied at load time using the fallback chain (birth/death → fl./index ± window → dynasty range → undated = include, with "hide undated" toggle).
- [ ] Merge candidates linked by DILA's `idno type="CBDB"` into one suggestion carrying both ids.
- [ ] Wire into the existing seed matcher / suggestion pipeline; suggestions carry source label + authority id + clue.

**Done when:** with CBDB persons + DILA persons both selected and a date range set, a real document produces deduped suggestions with correct clue lines, at acceptable load time and memory.

## Phase A4 — Authority panel UI

**Decide first:**
- [ ] Slider design: single year-range slider with dynasty presets as labeled stops (Markus-style) — or dynasty multi-select plus optional year refinement?
- [ ] Where per-source counts show (Markus shows match counts per category).

**Prepare:**
- [ ] Authority mode panel: checkbox per available source × category (CBDB persons/places/offices, DILA persons/places, project CSV), date slider, "hide undated" toggle.
- [ ] Review-panel additions: source badge, clue line, and DILA `disambiguation` cross-refs surfaced when both look-alikes match.
- [ ] Persist the user's source + date selection per project.

**Done when:** the full flow — pick sources, set period, run, review with clues — works end to end and unavailable sources are absent (not greyed).

## Phase A5 — Update checking

**Prepare:**
- [ ] Throttled check (≤ weekly, on app start): HuggingFace API for the CBDB dataset, GitHub API for the DILA repo; compare against manifests; offline = skip silently.
- [ ] "Update available" badge; on accept: download to temp, verify, recompile, atomically swap files + manifest. Never auto-replace (dictionary swaps change match results).

**Done when:** bumping a manifest to an older hash makes the badge appear, and accepting produces fresh artifacts without breaking a running session.

## Deferred / future

- Wikipedia/VIAF/Wikidata: Phase 4b reconciliation at entity-minting time, seeded by DILA's Wikidata idnos.
- Web-app support (databases are desktop-filesystem for now).
- DILA `ana` values other than `historical` — flag mythical/uncertain in the clue?
- Other authority sources behind the same source-manifest interface (Korean sets à la Markus, local gazetteers).
