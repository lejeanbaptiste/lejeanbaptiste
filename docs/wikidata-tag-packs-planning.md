# Wikidata tag packs — action plan

Status: planning (2026-07-05).  
Parent: [authority-packs-planning.md](authority-packs-planning.md).  
Build phases (human checkpoints): [authority extraction/docs/phases.md](../authority%20extraction/docs/phases.md).  
Scope: mine Wikidata into **offline tag string databases** for LEAF/LJB entity types **person, place, organization, work** (not `thing`). Surface forms only at tag time; **Q-id retained in the pack** for disambiguation lookup later (LINCS/Wikidata reconcile already wired in the app).

---

## 1. Goal

Build **versioned, downloadable packs** such as:

```
wikidata-person-zh-hant-tang/
wikidata-person-zh-hans-song/
wikidata-place-zh-hant-all/
wikidata-org-ja/
wikidata-work-zh-hant-classical/
```

Each pack contains:

- **Tag layer** — unique search strings (labels + aliases in the target language/script) → used by `dictionaryTag` / `MultiStringMatcher`
- **Index layer** — `string → [Q-id, …]` (and optional period metadata) → used at disambiguation, not during tag bomb

Tag time stays **tag-only** (no `@key` on corpus XML). The Q-id is not applied until the user disambiguates — but it must be in the pack so “lookup 300 candidates” is instant offline.

---

## 2. Design principles

| Principle | Rationale |
|-----------|-----------|
| **Language/script is the primary partition** | `zh-hant` ≠ `zh-hans` (different glyphs). Wikidata stores them as separate label/alias languages. |
| **Period is a filter dimension, not a string property** | Same 張衡 string may appear in multiple dynasty slices; load packs matching the project’s period slider. |
| **Membership heuristics, not one “Chinese people” class** | Wikidata has no single clean item for “Chinese person.” Use `instance of` + `country of citizenship (P27)` dynasty items + optional `ethnic group (P172)` + sitelinks — see §4. |
| **Surface forms only in the matcher** | Labels, aliases, `native label (P1705)` where present. Skip descriptions, sitelink titles unless validated as aliases. |
| **Official dumps, not live scraping** | Weekly [Wikidata JSON dump](https://www.wikidata.org/wiki/Wikidata:Database_download) (CC0) or batched SPARQL for prototypes. |
| **Ambiguity is normal** | One string → many Q-ids → same as today’s seed “one-to-many” bucket; review + disambiguation. |

---

## 3. Pack identity & manifest

### 3.1 Pack id convention

```
wikidata-{kind}-{language}[-{period}]
```

| Segment | Values |
|---------|--------|
| `kind` | `person` \| `place` \| `org` \| `work` |
| `language` | BCP-47: `zh-hant`, `zh-hans`, `ja`, `bo`, `en`, … |
| `period` (optional) | Dynasty slug: `tang`, `song`, `ming`, … or year range `-220_1911` |

Examples:

- `wikidata-person-zh-hant-tang` — humans with a `zh-hant` label/alias and P27 = Tang dynasty (or overlapping floruit)
- `wikidata-person-zh-hans` — all simplified-Chinese names (period filter applied at load time via metadata)
- `wikidata-place-zh-hant` — geographic entities with traditional-Chinese names (historical + modern)

### 3.2 `manifest.json`

```json
{
  "id": "wikidata-person-zh-hant-tang",
  "source": "wikidata",
  "wikidataDumpDate": "20260603",
  "buildToolVersion": "0.1.0",
  "kind": "person",
  "language": "zh-hant",
  "period": { "dynastyQid": "Q9683", "label": "Tang dynasty", "startYear": 618, "endYear": 907 },
  "entityCount": 12450,
  "stringCount": 18200,
  "license": "CC0",
  "attribution": "Data from Wikidata, structured data under CC0.",
  "files": {
    "strings": "strings.ndjson",
    "index": "qindex.ndjson"
  },
  "sha256": { "strings.ndjson": "…", "qindex.ndjson": "…" }
}
```

### 3.3 File formats

**`strings.ndjson`** — one row per **(Q-id, surface string)** for the matcher compiler (fed into `AuthorityCandidate.searchStrings`):

```json
{ "qid": "Q45678", "surface": "李白", "primary": true }
{ "qid": "Q45678", "surface": "李太白", "primary": false }
```

**`qindex.ndjson`** — one row per **Q-id** for disambiguation clues (optional at tag time, required for review):

```json
{
  "qid": "Q45678",
  "kind": "person",
  "primaryLabel": "李白",
  "description": "Tang dynasty poet",
  "p27": ["Q9683"],
  "birthYear": 701,
  "deathYear": 762
}
```

The existing `AuthorityCandidate` normalizer can consume these at compile time into the NDJSON shape described in [authority-packs-planning.md](authority-packs-planning.md).

---

## 4. What to query — by entity kind

Map to LJB / LEAF types ([`entities.ts`](../packages/cwrc-leafwriter/src/autoTagging/entities.ts)):

| LJB kind | TEI tag | Wikidata strategy |
|----------|---------|-------------------|
| `person` | `persName` | `P31` → `human (Q5)` |
| `place` | `placeName` / `geogName` | `P31` → geographic types (see below) |
| `org` | `orgName` | `P31` → `organization (Q43229)` and subclasses (business, religious org, dynasty as org, …) |
| `work` | `title` | `P31` → `creative work`, `literary work`, `book`, `poem`, … |

### 4.1 Persons — “Chinese people” without a single class

Wikidata models pre-modern Chinese persons with **dynasty as `country of citizenship (P27)`**, not “China (Q29520)” alone ([WikiProject CBDB import notes](https://www.wikidata.org/wiki/Wikidata:WikiProject_East_Asia/China_Biographical_Database_import)).

**Include when (configurable per pack):**

1. `wdt:P31/wdt:P279* wd:Q5` (human)
2. **Has label or alias in pack language** (`zh-hant`, `zh-hans`, `ja`, …)
3. **And** at least one of:
   - `wdt:P27` = target dynasty item (e.g. `Q9683` Tang, `Q1107` Song)
   - `wdt:P27` in a configured set of “Chinese dynasty/sovereign state” Q-ids (maintain a small **dynasty table** in the build repo — can seed from CBDB `DYNASTIES` + [WikiProject Chinese Culture and Heritage](https://www.wikidata.org/wiki/Wikidata:WikiProject_Chinese_Culture_and_Heritage) place/person models)
   - `wdt:P172` = `Han Chinese people (Q712008)` or related ethnic group (optional tighten/loosen)
   - Sitelink to `zhwiki` / `zh-classical` (optional — catches entries with weak P27)

**Exclude:**

- Humans with only English labels (belongs in `wikidata-person-en`, not zh packs)
- `P31` = `fictional human character` unless a pack explicitly wants them
- Strings of length ≤ 1 (LJB `DEFAULT_MIN_MATCH_LENGTH = 2`)

**Period assignment for persons:**

| Priority | Source | Use |
|----------|--------|-----|
| 1 | `P569`/`P570` birth/death | Intersect with dynasty year range |
| 2 | `P27` dynasty item | Pack membership + filter |
| 3 | `P2348` time period | When P27 missing |
| 4 | None | Put in “undated” pack or include with `metadata.endYear` null |

### 4.2 Places

**Include when:**

- `P31` → one of: `place`, `human settlement`, `administrative territorial entity`, `historical country`, `mountain`, `river`, … (maintain an allowlist of Q-ids, inspired by [WikiProject Chinese Culture and Heritage place model](https://www.wikidata.org/wiki/Wikidata:WikiProject_Chinese_Culture_and_Heritage))
- Label/alias in target language
- For **historical** packs: `P1480` valid in period, or `P131` chain under China, or `P4711` CHGIS id present
- For **modern** packs: `P17` country code or GeoNames overlap (optional cross-check)

**Period:** `P1480` (valid in period) strongly preferred for 縣/州/府; else dynasty from statement qualifiers.

**Note:** Wikidata place coverage for historical Chinese toponyms is **weaker than CBDB/CHGIS**. Wikidata place packs complement, not replace, [authority-databases-planning.md](authority-databases-planning.md) CBDB/CHGIS work.

### 4.3 Organizations

**Include when:**

- `P31` → `organization (Q43229)` or subclasses: `business`, `university`, `religious organization`, `dynasty` (as institutional), `government agency`, …
- Label/alias in target language
- Optional: `P17`/`P131` in China/Japan/… for regional packs

**Period:** `P571` inception / `P576` dissolved, or `P1480`, or dynasty P27 on historical orgs.

### 4.4 Works

**Include when:**

- `P31` → `creative work`, `literary work`, `book`, `poem`, `historical text`, …
- Label/alias in target language (often `title` strings — 史記, 論語)
- Optional: `P50` author link to a person in the same period pack (tighten classical corpora)

**Exclude:** Wikipedia disambiguation pages (`Q4167410` disambiguation), lists, categories.

---

## 5. Language handling (zh-hans vs zh-hant)

Wikidata distinguishes:

| Code | Script | Pack |
|------|--------|------|
| `zh-hant` | Traditional | Separate pack; matcher only loads one script pack per run (or user selects) |
| `zh-hans` | Simplified | Separate pack |
| `zh` | Often one or the other | **Do not merge** with hant/hans — treat `zh` labels as a third optional pack or map explicitly |
| `lzh` | Literary/Classical | Optional pack for classical corpora |

**Build step:** for each entity, collect:

- `labels[lang].value`
- `aliases[lang].value`
- `claims[P1705]` native label when language matches

**Normalization:** NFC, trim; optional traditional↔simplified conversion is **out of scope** (keep scripts separate).

---

## 6. Build pipeline — phases

### Phase W0 — Dynasty & kind tables — **done (2026-07-05)**

**Location:** [`authority extraction/wikidata/`](../../authority%20extraction/wikidata/) (sibling repo). See [authority-extraction.md](authority-extraction.md).

**Deliverables:**

- [`dynasties.json`](../../authority%20extraction/wikidata/dynasties.json) — 23 period presets (Qin→PRC): Wikidata Q-id, CE year range, 漢字/English labels, DILA/CBDB aliases
- [`kind-queries.json`](../../authority%20extraction/wikidata/kind-queries.json) — `P31` allowlists for person / place / org / work (+ exclusions)
- [`languages.json`](../../authority%20extraction/wikidata/languages.json) — pack languages ↔ LJB `zh-Hant` / `zh-Hans` / `ja` / … ↔ Wikidata label tags
- [`validate.mjs`](../../authority%20extraction/wikidata/validate.mjs) — run from extraction repo: `npm run validate`
- [`README.md`](../../authority%20extraction/wikidata/README.md) — how to edit and use the tables

**Validate:**

```bash
cd "../authority extraction" && npm run validate
```

**Exit:** tables reviewed; Tang/Song/Ming/Qing and Northern/Southern Song included; validator passes.

---

### Phase W1 — SPARQL prototypes (3–5 days)

Use [Wikidata Query Service](https://query.wikidata.org/) to validate counts and string quality **before** touching the full dump.

**Example person prototype (Tang, traditional labels):**

```sparql
SELECT ?item ?itemLabel ?alias ?citizenshipLabel ?birth ?death WHERE {
  ?item wdt:P31 wd:Q5 ;
        wdt:P27 wd:Q9683 .   # Tang dynasty
  ?item rdfs:label ?itemLabel .
  FILTER(LANG(?itemLabel) = "zh-hant")
  OPTIONAL {
    ?item skos:altLabel ?alias .
    FILTER(LANG(?alias) = "zh-hant")
  }
  OPTIONAL { ?item wdt:P569 ?birth }
  OPTIONAL { ?item wdt:P570 ?death }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 500
```

Run parallel prototypes for: `zh-hans`, places (`P31` geographic + `zh-hant` label), orgs, works.

**Measure:**

- Row counts per dynasty × language
- Sample 50 strings — are they real mention forms?
- Ambiguity rate: `SELECT ?alias (COUNT(DISTINCT ?item) AS ?c) … GROUP BY ?alias HAVING (?c > 1)`

**Exit:** go/no-go per kind; rough size estimates for first packs.

**Caveat:** WDQS timeout (~60s) and row limits — prototypes only; production uses dump parse.

---

### Phase W2 — Dump-based extractor (1–2 weeks)

**Status (2026-07-05):** Scripts live in **`authority extraction`** (`extract.mjs` + `compile.mjs`). Dump download in progress; work **paused** until it completes.  
**→ Operator checklist:** [authority extraction/wikidata/README.md — When the dump download finishes](../../authority%20extraction/wikidata/README.md#when-the-dump-download-finishes)

**Input:** [latest-all.json.bz2](https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.bz2) (~95 GiB compressed).

**Tool:** `authority extraction/wikidata/extract.mjs` (or Python — stream parse).

**Algorithm (streaming):**

1. Read each entity line from JSON array (or use existing stream splitters — see [Wikidata dump processing notes](https://www.wikidata.org/wiki/Wikidata:Database_download)).
2. Skip non-`item` types.
3. If `P31` matches kind allowlist → candidate.
4. Extract labels/aliases for target languages only.
5. Evaluate period membership (P27 in dynasty set, or birth/death overlap).
6. Emit to `strings.ndjson` + `qindex.ndjson`.

**Libraries:** `@wikimedia/json-stream` pattern, or Python `jq`-style streaming (document in tool README).

**Output:** raw pack directory per `(kind, language, period)`.

**Exit:** one full build of `wikidata-person-zh-hant-tang` on a dev machine; document RAM/time (expect hours, not minutes).

---

### Phase W3 — Post-process & quality gates (3–5 days)

| Gate | Rule |
|------|------|
| Min length | Drop `\|surface\| ≤ 1` for CJK |
| Numeric-only | Drop pure digits |
| Generic strings | Optional blocklist (中国, 日本, …) per kind |
| Deduplication | Same `(qid, surface)` once |
| Ambiguity report | `surfaces-ambiguous.csv` for human review |
| Size cap | Optional max strings per pack; split sub-packs if needed |

**Compare** sample against CBDB Tang persons — overlap and gaps (Wikidata should be wider, noisier).

**Exit:** quality report template; sign-off on Tang zh-hant person pack.

---

### Phase W4 — Compile into LJB `AuthorityCandidate` (2–3 days)

**Tool:** `compile-pack.ts` → existing NDJSON consumed by Phase A2 loader ([authority-databases-phases.md](authority-databases-phases.md)).

```typescript
// Conceptual: group strings by qid → AuthorityCandidate
{
  source: 'wikidata',
  authorityId: 'Q45678',
  kind: 'person',
  primaryName: '李白',
  searchStrings: ['李白', '李太白'],
  metadata: { startYear: 701, endYear: 762, dynasty: '唐' }
}
```

**Tag bomb path:** matcher loads **strings only**; `qindex` sidecar loaded lazily when disambiguation panel opens for a surface.

**Exit:** `compile-pack` tested; one pack loads in unit test with `MultiStringMatcher` benchmark.

---

### Phase W5 — Distribution & updates (3–5 days)

| Decision | Recommendation |
|----------|----------------|
| **Host** | GitHub Release or HuggingFace dataset (like CBDB) — packs are 10–200 MB compiled, not 100 GB |
| **Pre-ship vs download** | Download on first use; optional “Install Wikidata packs” in authority UI |
| **Update cadence** | Monthly rebuild off weekly dump; manifest `wikidataDumpDate` |
| **User override** | Advanced: point at custom pack URL |

**Exit:** LJB desktop can download `wikidata-person-zh-hant-tang`, verify sha256, compile if needed, run tag bomb.

---

### Phase W6 — UI integration (ties to authority phases A3–A4)

- Authority panel checkbox: **Wikidata persons (zh-hant, Tang)**
- Period slider selects dynasty packs to load
- Language from **project source language** (`zh-Hant` → hant packs)
- Review: on ambiguous hit, disambiguation uses **LINCS Wikidata** + local `qindex` (Q-id shortlist)

**Exit:** end-to-end tag → review → disambiguate with Wikidata idno on entity.

---

## 7. Recommended first packs (v1)

Ship small, validate, expand.

| Pack id | Est. strings | Priority |
|---------|--------------|----------|
| `wikidata-person-zh-hant-tang` | 5k–15k | **P0** — classical DH corpus |
| `wikidata-person-zh-hant-song` | 10k–25k | P0 |
| `wikidata-person-zh-hans` (all periods, metadata filter) | 100k+ | P1 — modern/simple |
| `wikidata-work-zh-hant` | 5k–20k | P1 — **title** tag for classical Chinese corpora |
| `wikidata-place-zh-hant` | 20k–80k | P2 — noisy; compare CHGIS |
| `wikidata-org-zh-hant` | 5k–15k | P2 |
| `wikidata-person-ja` | 50k+ | P3 — **supplement** to NDL persons (not replacement) |
| `wikidata-work-ja` | varies | P2 — **title**; NDL works batch is small (~900) |

**Do not v1:** full multilingual all humans, `thing`, lexemes, Wikipedia sitelink titles as aliases.

---

## 8. Disambiguation without tagging ids

Your constraint: **tag database = surface forms only.**

Flow:

```
Tag bomb match "王安石"
  → review list (no id yet)
  → user accepts tag
  → disambiguation: qindex.lookup("王安石") → [Q333323, Q…, Q…]
  → LINCS/Wikidata reconcile OR pick from qindex clues
  → write @key + <idno type="wikidata"> on entity
```

The pack’s **`qindex.ndjson`** is the offline shortlist so you are not querying Wikidata for every string in the document — only confirming among known Q-ids that share that surface, plus live reconcile for edge cases.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| WDQS too slow / limited | Production = dump parse only |
| “Chinese people” too fuzzy | Dynasty-scoped packs; optional P172; document false-positive rate |
| zh-hans/hant mixed labels on one item | Emit both; user loads one pack |
| String ambiguity (王安石) | Existing one-to-many bucket + disambiguation |
| Stale data | Versioned manifests; monthly rebuild |
| Place noise | Prefer CBDB/CHGIS for zh places; Wikidata as supplement |
| Build complexity | Start W0–W1 manually; automate W2 once Tang pack validated |

---

## 10. Open decisions (for you)

1. **Dynasty packs vs one big zh-hant person pack + load-time filter?**  
   Recommendation: **both** — dynasty packs for classical (smaller, cleaner); monolithic `zh-hant-persons` with metadata for modern projects.

2. **Include sitelink page titles as aliases?**  
   Recommendation: **no** for v1 (too many disambiguation page titles).

3. **Fictional characters?**  
   Recommendation: exclude unless pack flag `includeFictional=true`.

4. **Where build tools live?**  
   Recommendation: [`authority extraction`](../authority%20extraction/) sibling repo; CI builds packs on release tag only (not every commit). See [authority-extraction.md](authority-extraction.md) and [phases.md](../authority%20extraction/docs/phases.md).

5. **Overlap with CBDB packs?**  
   Recommendation: ship both; dedupe at disambiguation via shared Q-id / CBDB idno on Wikidata items ([~2k DILA↔Wikidata links](authority-databases-planning.md) show the pattern).

---

## 11. Timeline sketch

| Week | Milestone |
|------|-----------|
| 1 | W0 tables + W1 SPARQL prototypes; size estimates |
| 2–3 | W2 extractor; first `wikidata-person-zh-hant-tang` raw build |
| 4 | W3 quality gates + W4 compile to AuthorityCandidate |
| 5 | W5 host pack + manual tag bomb test on gold passage |
| 6+ | W6 UI + additional dynasties / works / ja |

Parallel: CBDB compile (Phase A2) remains higher priority for Chinese biography **quality**; Wikidata packs widen coverage.

---

## 12. Success criteria

**Done when:**

1. User with `zh-Hant` Tang project downloads one pack, runs tag bomb, gets sensible `persName` suggestions.  
2. Ambiguous strings open disambiguation with Q-id shortlist from `qindex`, not blind Wikidata search.  
3. Rebuild from new dump produces new manifest hash; user can update voluntarily.  
4. Documented build recipe — anyone can reproduce `wikidata-person-zh-hant-tang` from upstream dump.

---

## 13. References

- [Wikidata:Database download](https://www.wikidata.org/wiki/Wikidata:Database_download) — CC0 structured data  
- [WikiProject East Asia / CBDB import](https://www.wikidata.org/wiki/Wikidata:WikiProject_East_Asia/China_Biographical_Database_import) — P27 dynasty modeling  
- [WikiProject Chinese Culture and Heritage](https://www.wikidata.org/wiki/Wikidata:WikiProject_Chinese_Culture_and_Heritage) — person/place data models  
- [WDumper](https://wdumps.toolforge.org/) — optional alternative for RDF slices  
- LJB: [authority-packs-planning.md](authority-packs-planning.md), [`authority.ts`](../packages/cwrc-leafwriter/src/autoTagging/authority.ts), [`lincs-api.ts`](../packages/cwrc-leafwriter/src/services/lincs-api.ts) (Wikidata reconcile)
