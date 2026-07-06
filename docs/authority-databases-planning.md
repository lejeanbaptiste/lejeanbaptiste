
# Vague base plan (superseded in part — see [authority-packs-planning.md](authority-packs-planning.md))

We should look into offering to scrape all names for persons, places, orgs, etc. from the base authorities (WikiData, VIAF, etc.) if possible. Unclear whether the user should do this OR if pre-ship. **Updated 2026-07-05:** prefer **official dumps → compiled authority packs → tag bomb**; see the new planning doc for source-by-source feasibility. Wikidata/VIAF are pack inputs, not live scrape targets.

# Authority databases: CBDB + DILA integration plan

Status: planning (studied 2026-07-04 against the files in `databases/`).
Scope: Chinese-language authority sources for the auto-tagging "authority" mode
(Phase 4a matching; entity/id minting stays in Phase 4b per the tagging-only rule).

## 1. What we have on disk

| File | Format | Records | Contents |
|---|---|---|---|
| `cbdb_20260627.sqlite3` (550 MB) | SQLite | 659,593 persons | China Biographical Database, full relational dump |
| `cbdb_20260627.json` | manifest | — | sha256 + HuggingFace source URL (`datasets/cbdb/cbdb-sqlite`) |
| `Buddhist_Studies_Person_Authority.xml` (49 MB) | TEI listPerson | 49,190 persons | DILA person authority |
| `Buddhist_Studies_Place_Authority.xml` (30 MB) | TEI listPlace | 117,408 places | DILA place authority |
| `districts.xml` | TEI listPlace | — | DILA administrative-district hierarchy (countries → districts, `PLA…` ids referenced by place records' `<location><place key>`) |
| `all_together.csv` | CSV | 74,200 rows | Markus-style flat dictionary (persName / officeName / placeName / ntName / title) — already consumed by `autoTagging/authority.ts` |

## 2. CBDB: relevant columns

### Persons — `BIOG_MAIN` (659,593 rows)

| Column | Use |
|---|---|
| `c_personid` | authority id (`cbdb:<id>`) |
| `c_name_chn` | primary match string (漢字) |
| `c_name` | pinyin — display only, not a match string |
| `c_birthyear`, `c_deathyear` | dates for clue + filtering (only ~60k have birthyear) |
| `c_index_year` | CBDB's "best single year" (307k coverage) — fallback for filtering |
| `c_fl_earliest_year`, `c_fl_latest_year` | floruit fallback |
| `c_dy` → `DYNASTIES` | dynasty code; **648k/659k coverage** — the workhorse for both the clue and the period filter |
| `c_female` | optional clue detail |

`DYNASTIES` gives `c_dynasty_chn` (宋), `c_dynasty` (Song), and `c_start`/`c_end`
year ranges — this is what powers a Markus-style "dynasties selection" without
needing per-person dates.

### Alternative names — `ALTNAME_DATA` (207,576 rows) + `ALTNAME_CODES`

Join on `c_personid`; `c_alt_name_chn` is the match string. Include by type code:

- **Include**: 4 courtesy name 字 (101k), 5 studio/style name 別號 (27k), 6 posthumous 諡號, 3 alternate name, 19 dharma name, 14 temple name, 8 enfeoffment title, 11 bestowed name.
- **Exclude or gate**: 7 birth-order name 行第 (14.8k — strings like 十二郎, hugely ambiguous), 0 unknown (45k — review a sample before deciding), childhood names (9, 10 — often 1–2 chars).

General guard: drop match strings shorter than 2 chars regardless of type.

### Places — `ADDR_CODES` (30,100 rows)

`c_addr_id`, `c_name_chn`, `c_alt_names`, **`c_firstyear`/`c_lastyear`** (historical
validity — so the date slider applies to places too), `c_admin_type` (subtype for
the clue: 縣/州/府…), `x_coord`/`y_coord`, `CHGIS_PT_ID`.

### Official titles — `OFFICE_CODES` (34,063 rows)

`c_office_id`, `c_office_chn` (+ `c_office_chn_alt`), `c_office_trans` (Hucker-style
English), and **`c_dy`** — each office belongs to a dynasty, so the period filter
applies naturally. This is Markus's 官名 category. TEI target for `officeName` is
still the open modeling question from Phase 4a (likely `<roleName>` at tag time,
no entity).

## 3. DILA: relevant elements

### Person authority (TEI `<person>`, 49,190 records)

- `xml:id` (`A######`) — authority id (`dila:A…`).
- `<persName>` primary + `type="alternative"` (all zho-Hant) — match strings.
- `<birth>`/`<death>` — ISO-ish (`+0596-01-01 ~ +0596-12-31`); only ~8–9k records. Parse the year only.
- `<note type="dynasty">` — **47k/49k coverage**; free-text (北宋, 唐). Map to year ranges via CBDB's `DYNASTIES` table (plus a small alias table for 北宋/南宋 etc.) so the date slider works.
- `<note type="concise">` — one-paragraph bio; first clause ("北宋譯經僧") is a superb clue.
- `<note type="monk">`, `<occupation>`, `<note type="sect">` — optional clue detail.
- `<note type="placeOfOrigin">` — contains a `PL…` ref into the place authority.
- **`<idno type="CBDB">` (1,999 records) and `<idno type="Wikidata">` (2,257)** — cross-links. Use the CBDB ones to dedupe when both sources are checked, and the Wikidata ones as the future bridge to Wikipedia/VIAF.
- `<note type="disambiguation">` — explicit "not to be confused with A######" pointers; surface in the review panel when both candidates match.

### Place authority (TEI `<place>`, 117,408 records)

- `xml:id` (`PL…`), `<placeName>` in zho-Hant (+ eng-Latn, jpn — display only).
- `<location><place key="PLA…">` → district name via `districts.xml`; `<geo>` coordinates.
- `<note type="category">` (寺/山/州…) — subtype + clue.
- **No temporal data** → the date slider must not silently exclude DILA places; treat "no dates" as "always in range".

## 4. The one-line disambiguation clue

Format: `名 (pinyin/romanization, dates, dynasty — extra)`, dropping whatever is absent.

- CBDB person: `王安石 (Wang Anshi, 1021–1086, 宋 Song)`; if no dates, `(fl. 1080, 宋)` from index/fl year; worst case dynasty alone.
- DILA person: `道宣 (596–667, 唐 — 明律)` or, lacking dates, dynasty + first clause of `concise`: `金總持 (北宋 — 譯經僧)`.
- CBDB place: `臨川 (縣, 宋, 今江西撫州)` — name, admin type, valid years/dynasty.
- DILA place: `淨業寺 (寺 — 陝西西安)` — name, category, district chain.
- CBDB office: `參知政事 (Vice Grand Councilor, 宋)` — the English translation is the clue.

## 5. Time-period filtering

One slider (years, with dynasty presets as labeled stops, like Markus's
"dynasties selection"). A candidate passes if its interval intersects the range:

1. birth–death if present;
2. else fl. earliest–latest / index_year ± a window (say ±30);
3. else the dynasty's `c_start`–`c_end`;
4. else (no data at all): configurable — default *include*, with a "hide undated" toggle.

Dynasty presets come straight from `DYNASTIES` (id, 漢字, English, start, end, sort).

## 6. Infrastructure

### Language gating
- Project language becomes a fixed-code picker (BCP-47: `zh-Hant`, `zh-Hans`, `en`, `fr`, …), not free text.
- CBDB/DILA sources are offered only when a project (or translation pane language) is Chinese.

### Fetch-on-demand
- When Chinese is selected, offer "Download authority databases". Fetch:
  - CBDB: HuggingFace URL already recorded in `cbdb_20260627.json`; verify sha256; unzip.
  - DILA: GitHub (`DILA-edu/Authority-Databases`) — person, place, districts XML.
- Store under `databases/`; a source appears in the UI only if its file is present and passes checksum/parse.

### Compile step (important)
Don't parse 550 MB SQLite / 49 MB XML at tagging time. On first download (or when
the file's hash changes), compile each source into a compact normalized artifact —
`AuthorityCandidate` records (see `autoTagging/authority.ts`), one NDJSON (or
msgpack) file per source × kind, e.g. `cbdb.person.ndjson`, `dila.place.ndjson`.
The compile step is where column selection, altname-type filtering, dynasty→year
resolution, and short-string dropping happen. The matcher then only ever sees the
normalized shape — `all_together.csv` becomes just another compiled source.

Scale note: CBDB persons ≈ 660k entities / ~850k match strings. The Aho-Corasick-style
seed matcher should handle it, but memory-profile the compiled dictionary; if needed,
the date filter can be applied at load time (before building the automaton) rather
than per-match.

Dedup by string: the automaton is built over *unique strings*, not candidates.
At load time, fold the selected sources' search strings into one
`Map<string, AuthorityCandidate[]>`; each string enters the automaton once and a
hit fans out to all candidates that share it (王安石 the statesman and any
namesakes are one search, many suggestions). This also collapses the heavy
cross-source overlap (DILA monks largely re-appear in CBDB).

### Update checking
Each installed source keeps a small manifest (`source, version/date, sha256,
upstream URL, installedAt` — CBDB's downloaded JSON already is one; write an
equivalent for DILA). On a throttled schedule (e.g. at most weekly, on app
start), ping upstream:

- CBDB: HuggingFace API for `datasets/cbdb/cbdb-sqlite` — compare latest file
  path/hash against the manifest.
- DILA: GitHub API for `DILA-edu/Authority-Databases` — compare latest commit
  touching the authority files.

If newer, show a non-blocking "update available" badge on the source in the
authority panel / settings. Only on user accept: download to a temp path, verify
checksum, recompile the NDJSON artifacts, then atomically replace the old files
and manifest. Never auto-replace — a mid-project dictionary swap changes match
results, so the user decides when. Offline or API failure = silently skip the
check.

### UI (authority mode)
- Keep the list/authority distinction. Authority mode opens a Markus-style panel:
  checkboxes for each *available* source × category (CBDB persons, CBDB places,
  CBDB offices, DILA persons, DILA places, project CSV…), plus the date slider.
- Multiple sources may propose the same string: keep both suggestions with a source
  badge; when a DILA record carries `idno type="CBDB"` matching a CBDB candidate,
  merge them into one suggestion listing both ids.

### Deferred / open questions
- Wikipedia/VIAF/Wikidata: not a match source. Best fit is Phase 4b reconciliation —
  when minting an entity, use DILA's Wikidata idno (or a lookup service) to attach
  extra idnos. Design later.
- `officeName` TEI mapping (roleName vs. entity) — carried over from Phase 4a notes.
- Whether to include CBDB altname type 0 "Unknown" (45k strings) — sample and decide.
- DILA "historical" vs. other `ana` values on `<person>` — check if mythical/uncertain
  records should be flagged in the clue.
