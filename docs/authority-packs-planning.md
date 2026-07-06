# Authority packs & the tag-bomb strategy

Status: planning (2026-07-05).  
Companion to [Auto-tagging.md](Auto-tagging.md), [authority-databases-planning.md](authority-databases-planning.md), [authority-databases-phases.md](authority-databases-phases.md), [authority-extraction.md](authority-extraction.md).

This document reframes auto-tagging priorities after the first live AI runs: **what to build next**, **how mainstream authority sources can be scraped/packaged/distributed as tag strings**, and **where AI fits** relative to Norbert/MARKUS-style “tag bombs.”

---

## 1. Executive summary

**The feeling of being lost is structural, not a failure of the AI work.** LJB has been building shared infrastructure (suggestion objects, review UI, apply engine, chunking, cache) plus two different *products* at once:

| Layer | Job | Maturity in LJB |
|-------|-----|-----------------|
| **Tag bomb** | Match known strings → wrap in tags | Engine ready (`dictionaryTag`, `MultiStringMatcher`, `seedSuggestions`); CBDB/DILA download manager built; **compile + UI not finished** |
| **AI suggest** | Find mentions lists miss | Wired (desktop); Groq Qwen3.6 + `suggest.v3` ≈ F1 0.74 on Chinese gold |
| **AI audit** | Critique existing tags | Wired; prompt/retag semantics need work |
| **Disambiguation** | Pick which 張衡 | Partially built (Phase 4b) |

**Recommendation:** treat **authority packs → tag bomb** as the primary throughput path for the next development cycle. Keep AI as a **long-tail supplement** (gaps, cleanup), not the main way users tag thousands of names.

**Do not try to solve “all languages, all tag types, all models” in one pass.** Ship **packs** partitioned by:

- language/script (e.g. `zh-Hant-persons`, `ja-persons`, `global-places-geographic`)
- entity kind (person / place / org / work / office strings)
- optional period filter metadata (dynasty, year range)

AI prompt tuning is **per pack + per model**, optional, and later — not a prerequisite for useful tagging.

---

## 2. Why tag bombs beat AI for quantity

Norbert and MARKUS succeed because:

1. **Deterministic** — same input list → same matches; no model drift.
2. **Cheap** — no API cost; runs offline on large corpora.
3. **Inspectable** — user sees *why* (dictionary row, authority id, clue line).
4. **Language-agnostic architecture** — swap the string list, keep the matcher.

LJB already matches this design:

- `dictionaryTag` + `MultiStringMatcher` — O(text × distinct string lengths), not O(all patterns × text).
- `AuthorityCandidate` — normalized shape for any source ([`authority.ts`](../packages/cwrc-leafwriter/src/autoTagging/authority.ts)).
- Review walk + apply + snapshot revert — same for dictionary, seed, crawl, and AI.

Phase 4a explicitly positioned AI as supplement ([Auto-tagging-phases.md](Auto-tagging-phases.md) Phase 4a). The AI investment was not wasted — it handles what lists cannot — but **lists should lead**.

---

## 3. What “authority pack” means

An **authority pack** is a versioned, downloadable artifact LJB installs beside the user’s entity database (`<entityDbFolder>/authority-databases/` or a sibling `authority-packs/` directory).

### 3.1 Pack contents (target format)

**Compiled layer** (what the matcher loads — same as planned NDJSON in authority-databases phases):

```
packs/
  wikidata-humans-zh/
    manifest.json          # id, version, sha256, languages, kinds, upstream, license
    persons.ndjson         # one AuthorityCandidate per line (JSON)
  cbdb/
    persons.ndjson
    places.ndjson
    offices.ndjson         # roleName strings at tag time; entity home TBD
```

Each NDJSON record matches the existing `AuthorityCandidate` shape:

```json
{
  "source": "wikidata",
  "authorityId": "Q1234",
  "kind": "person",
  "primaryName": "王安石",
  "searchStrings": ["王安石", "王介甫"],
  "metadata": {
    "dynasty": "宋",
    "startYear": 1021,
    "endYear": 1086,
    "description": "Northern Song statesman"
  }
}
```

**Optional raw layer** (for recompile on update): SQLite, TEI XML, or upstream dump — same as today’s CBDB/DILA files.

### 3.2 What we extract from each source

| Field | Tag-bomb use | Disambiguation use |
|-------|----------------|---------------------|
| **searchStrings** | Required — what we match in running text | — |
| **authorityId** | Carried on suggestion for later `@key` / `<idno>` | Required |
| **kind** | Maps to TEI tag (`persName`, `placeName`, …) | — |
| **dynasty / startYear / endYear** | Optional **load-time filter** (Markus dynasty slider) | Clue line + precision gate |
| **description / subtype** | — | Review panel clue |

**Tag time stays tag-only** (no `@key` on corpus XML until disambiguation — enforced 2026-07-05).

### 3.3 Distribution model

| Who builds packs | When |
|------------------|------|
| **LJB project (pre-ship)** | Chinese: CBDB + DILA + one Wikidata subset; Japanese: NDL name sample; global places: GeoNames subset |
| **User import** | CSV/TSV/xlsx (already works) |
| **Future: pack builder CLI** | Power users compile custom packs from SQL/Wikidata SPARQL |

**Updates:** manifest + sha256; user accepts updates (never auto-replace mid-project) — same rule as [authority-databases-planning.md](authority-databases-planning.md) §6.

**Attribution:** each pack’s `manifest.json` lists license + required credit string (CC0, CC-BY, ODC-By, academic-only, etc.).

---

## 4. Source-by-source feasibility research

Below: can we get **bulk strings + ids + dates** offline? License? Realistic pack size? Fit for LJB?

Legend: **Tag** = good for string matching; **Link** = better for disambiguation/idnos after tag; **Hard** = no clean bulk path.

### 4.1 Already in the repo / pipeline

| Source | Records (order of magnitude) | Bulk access | Strings | IDs | Dates/dynasty | License | Verdict |
|--------|------------------------------|-------------|---------|-----|---------------|---------|---------|
| **CBDB** | ~660k persons; ~30k places; ~34k offices | HuggingFace SQLite zip (pinned in [`authorityDatabases.ts`](../apps/desktop/src/authorityDatabases.ts)); download manager **built** | `c_name_chn` + filtered `ALTNAME_DATA` | `cbdb:<personid>` etc. | `c_dy`→dynasty; birth/death/floruit | Academic / project terms on dataset | **High** — compile step (Phase A2) is the blocker |
| **DILA** | ~49k persons; ~117k places | GitHub XML (pinned commit); download **built** | `<persName>`, `<placeName>` | `dila:A…`, `dila:PL…` | `<note type="dynasty">`; sparse birth/death | Check DILA terms; batch reuse allowed | **High** — TEI-shaped, easy normalizer |
| **DPM `all_together.csv`** | ~74k rows | Local file | string + tag column | person_id / office_id | start_year, end_year, dynasty | Internal test data | **Done** — validates pipeline; not for distribution |

### 4.2 Wikidata

| Aspect | Detail |
|--------|--------|
| **Bulk access** | Full JSON dump ~95–140 GiB compressed ([Wikimedia dumps](https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.bz2)); weekly updates; **CC0** on structured data |
| **Custom subsets** | [WDumper](https://wdumps.toolforge.org/) — filter e.g. `instance of: human` + language labels; outputs RDF with labels/aliases; queue-based; can export to Zenodo |
| **Alternative** | Wikidata Query Service (SPARQL) for bounded exports; good for prototyping, not for shipping 500k strings without a build pipeline |
| **Strings** | Labels + aliases per language (`zh`, `ja`, `bo`, …) |
| **IDs** | `wikidata:Q…` |
| **Dates** | `P569`/`P570` birth/death; `P2348` time period; quality varies |
| **Scale** | Humans alone: millions of items; **must filter** by language, occupation, citizenship, or sitelink |
| **Verdict** | **High for pack building, medium operational cost.** Do not ship full dump. Build packs: `wikidata-humans-zh-Hant`, `wikidata-humans-ja`, `wikidata-places-with-sitelink-zh`, etc. Recompile when dump date changes. |

**Suggested v1 pack query shape (conceptual):** items with `instance of: human (Q5)` AND (label OR alias) in language X AND (country of citizenship OR field of work OR sitelink to zhwiki/jawiki). Export labels, aliases, P569/P570, P27, P214 VIAF id for later linking.

### 4.3 VIAF

| Aspect | Detail |
|--------|--------|
| **Bulk access** | Cluster dumps at [viaf.org/viaf/data/](https://viaf.org/viaf/data/) (XML/RDF/MARC per line) |
| **Status (2026)** | **Last updated August 2024; OCLC paused updates** during infrastructure work |
| **Strings** | Many variant names per cluster; strong for Western names; CJK coverage uneven |
| **IDs** | `viaf:…` |
| **Dates** | Often present in cluster records |
| **License** | [ODC Attribution](https://viaf.org/viaf/data/) — credit required |
| **Verdict** | **Medium for global person linking; weak as primary CJK tag list.** Better as **idno target during disambiguation** (Wikidata and DILA already carry VIAF/Wikidata crosswalks). Revisit when dumps resume. |

### 4.4 GeoNames

| Aspect | Detail |
|--------|--------|
| **Bulk access** | [download.geonames.org](https://download.geonames.org/export/dump/) — `allCountries.zip`, per-country zips, `alternateNamesV2.zip` |
| **Scale** | ~11M features; ~11M alternate names |
| **Strings** | `name`, `alternatenames`, `countryCode`, feature class |
| **IDs** | `geonameId` |
| **Dates** | **None** (modern gazetteer) |
| **License** | **CC-BY 4.0** — attribution to GeoNames |
| **Verdict** | **High for modern geographic `placeName`/`geogName` packs**, especially per-country (`CN.zip`, `JP.zip`, `IN.zip`). Poor for historical Chinese toponyms — pair with CHGIS. Filter by feature class (PPL, ADM, …) to reduce noise. |

### 4.5 CHGIS / TGAZ (historical China places)

| Aspect | Detail |
|--------|--------|
| **Bulk access** | [Harvard Dataverse CHGIS v6](https://dataverse.harvard.edu/dataverse/chgis_v6); TGAZ API/CSV ([tgaz](https://github.com/cga-harvard/tgaz)) |
| **Strings** | Historical 漢字 place names, multiple time slices |
| **IDs** | CHGIS / `hvd_*` TGAZ ids |
| **Dates** | **Core feature** — year ranges, dynasties |
| **License** | **Academic free; no commercial redistribution** (read Dataverse terms) |
| **Verdict** | **High for Chinese historical place packs**; complements CBDB places + GeoNames modern names. Not a person source. |

### 4.6 Web NDL Authorities (Japan)

| Aspect | Detail |
|--------|--------|
| **Bulk access** | [Batch download](https://id.ndl.go.jp/information/download_en/) — **Works, NDLSH, GFT only** (not personal names); **SPARQL 1.1** for persons/places (~1M+ name records) |
| **Scale** | ~1M+ name authority records (SPARQL); works batch smaller and updated quarterly |
| **Strings** | Japanese names + variant terms |
| **IDs** | NDL authority ids |
| **Dates** | Limited in authority records |
| **License** | Reuse allowed with attribution (see NDL terms) |
| **Verdict** | **High for Japanese person/place/title packs.** Strong first non-Chinese pack. |

### 4.7 Tibetan / Himalayan (THL)

| Aspect | Detail |
|--------|--------|
| **Bulk access** | [THL Place Dictionary](https://thlib.org/places/) — **no public bulk download**; contributor spreadsheets + internal API |
| **Scale** | ~21k places claimed |
| **Strings** | Tibetan, Wylie, Chinese, English variants per place |
| **Verdict** | **Hard for automated pack.** Options: (1) ask THL/UVa for export or partnership; (2) seed from Wikidata items with Tibetan labels; (3) user-maintained CSV. Do not block other packs on this. |

### 4.8 Getty ULAN / TGN

| Aspect | Detail |
|--------|--------|
| **Bulk access** | LOD SPARQL + **NTriples zips** at [vocab.getty.edu](https://vocab.getty.edu/) (`ulan/full.zip`, `tgn/full.zip`) |
| **Scale** | ~527k ULAN; ~3M TGN |
| **Strings** | Artist names, place names — **art/architecture focus** |
| **License** | ODC-By — attribution |
| **Verdict** | **Medium** — useful for **Western art historical** projects (already have LGPN in codebase history). Extract via SPARQL or parse NTriples; not priority for classical Chinese. |

### 4.9 Wikipedia

| Aspect | Detail |
|--------|--------|
| **Verdict** | **Poor primary tag source** — article titles ≠ mention forms; disambiguation pages; licensing mixed (CC-BY-SA on text). Use **Wikidata** derived from Wikipedia instead. |

### 4.10 Summary matrix

| Source | Tag bomb | Pack effort | CJK | Japanese | Tibetan | Historical dates |
|--------|----------|-------------|-----|----------|---------|------------------|
| CBDB | ✅ | Low (compile only) | ✅ | — | — | ✅ |
| DILA | ✅ | Low | ✅ (Buddhist bias) | — | — | Partial |
| Wikidata subsets | ✅ | Medium | ✅ | ✅ | Partial | Partial |
| GeoNames | ✅ places | Low | ✅ | ✅ | Partial | ❌ |
| CHGIS | ✅ places | Medium | ✅ | — | — | ✅ |
| NDL | ✅ | Medium | Partial | ✅ | — | Partial |
| VIAF | ⚠️ link | Medium | Weak | Weak | — | Partial |
| Getty ULAN/TGN | ✅ niche | Medium | Weak | Weak | — | ❌ |
| THL | ✅ if obtained | **Hard** | Partial | — | ✅ | Partial |

---

## 5. Scraping vs official dumps — policy

**Prefer official bulk dumps or licensed exports.** Scraping live websites (Wikipedia HTML, VIAF search UI) is fragile, often against terms of service, and unnecessary when dumps exist.

| Approach | Use when |
|----------|----------|
| **Official dump + compile script** | CBDB, DILA, GeoNames, Wikidata, Getty NTriples, NDL batch files |
| **SPARQL / API export (batch)** | Custom Wikidata slices, NDL, Getty — run offline builder, ship result as pack |
| **Partnership / manual export** | THL, proprietary gazetteers |
| **Live API at tag time** | **Avoid** for tag bomb (latency, rate limits, non-determinism) — reserve for disambiguation |

**Build pipeline (out of app):** `tools/authority-pack-build/` (future) — Python or Node scripts that ingest raw dumps and emit `manifest.json` + NDJSON. LJB desktop app only **downloads pre-built packs** or compiles from raw files the user already fetched (CBDB/DILA path).

---

## 6. Language & tag-type strategy

You cannot anticipate every project’s tag set. **Ship packs by language + kind; let the project schema choose TEI tags.**

### 6.1 v1 pack lineup (proposed)

1. **`cbdb-persons-zh`** — classical/modern Chinese biographical names + alt names; dynasty metadata  
2. **`cbdb-places-zh`** — historical admin places  
3. **`cbdb-offices-zh`** — office strings → `<roleName>` at tag time (entity modeling still open)  
4. **`dila-persons-zh` / `dila-places-zh`** — Buddhist-studies corpora  
5. **`wikidata-persons-zh`** — WDumper or custom dump: humans with zh labels  
6. **`geonames-places-{CC}`** — per-country geographic names (CN, JP, TW, …)  
7. **`ndl-persons-ja` / `ndl-places-ja`** — when Japanese projects ship  

Tibetan: **`wikidata-places-tibetan-labels`** as interim; pursue THL separately.

### 6.2 Tag types vs packs

| Pack kind | Default TEI tag | Standoff entity? |
|-----------|-----------------|------------------|
| person strings | `persName` | Yes (`listPerson`) |
| place strings | `placeName` or `geogName` | Yes (`listPlace`) |
| org strings | `orgName` | Yes (`listOrg`) |
| work/title strings | `title` | Yes (`listBibl`) |
| office strings | `roleName` | **Open** — tag in corpus; may not mint entity (Phase 4a note) |

**Project tagging guide** (user-authored, 10–20 bullets) sits above all packs: “regnal names → X”, “offices → roleName”, etc. Packs do not encode TEI philosophy — they encode **matchable strings**.

---

## 7. AI, audit, and automated prompt tuning

### 7.1 Where AI still fits (after tag bomb)

| Use | Priority |
|-----|----------|
| Mentions **not in any pack** | Medium |
| **Cleanup** after dumb tag (audit remove/add) | Medium — fix retag semantics first |
| **Disambiguation ranking** (Phase 4b+) | High long-term |
| Primary tagging of 10k+ names | **Low** |

### 7.2 Audit issues observed (2026-07-05)

- Model says “not persName, regnal name” but **`tag` field stays `persName`** → apply does nothing on retag.  
- **Fix (planned):** prompt must require `tag` = target tag on retag; UI shows `persName → ?`; expand allowed tags in audit request.  
- **Deeper issue:** without a project tagging guide, audit encodes implicit TEI opinions users may reject.

### 7.3 Automated prompt tuning loop — feasible?

**Yes, as an optional lab tool**, not as core product architecture.

```
gold XML → run suggest → measure P/R/F1 → LLM proposes edit to task block only
→ re-run → keep best → stop at N iterations or F1 threshold
```

| Pros | Cons |
|------|------|
| Per-user, per-corpus, per-model profiles | Overfits single gold file |
| Reduces hand-editing `prompt-templates/` | Expensive (many API calls) |
| Same harness as today (`validationHarness.live.test`) | Does not help tag bomb |
| | Still breaks when model is swapped |

**Recommendation:** build **after** (1) authority pack tag bomb works end-to-end, (2) 2–3 gold passages exist per corpus type. Lock preamble + JSON schema; tune only tag definitions + task bias. Human approves saved profile. See [Auto-tagging.md](Auto-tagging.md) § Immediate future A.

---

## 8. Norbert-style structures (`<appointment>`, `person_id` on roles)

TEI does not offer one standard for “person P held office O in year Y” that matches Norbert’s SQL attributes.

| Norbert pattern | LJB direction |
|-----------------|---------------|
| Nested `<appointment>` with persName + roleName + date | **Custom ODD element** — valid if schema defines it; not in default packs |
| `person_id` on `<roleName>` | **Non-TEI** — avoid in interchange; use `@corresp` / standoff / event table later |
| Flat tag bomb then CSV disambiguation | **Current LJB path** — matches Phase 2–4 design |

**Do not block tag-bomb work on appointment modeling.** Tag offices as `roleName` strings first; structural encoding is a **schema/project decision**, not an auto-tagging prerequisite.

---

## 9. Recommended work phases

### Phase P0 — Finish Chinese tag bomb (highest ROI)

Already specified in [authority-databases-phases.md](authority-databases-phases.md) A2–A4:

1. **Compile** CBDB + DILA → NDJSON `AuthorityCandidate` files  
2. **Wire loader** + date/dynasty filter at load time  
3. **Authority panel UI** — source × category checkboxes, period slider  
4. **Dialog method:** “Tag from authority packs” → review → apply (tag-only, no `@key`)

**Exit:** user with Chinese biography project tags a chapter from CBDB persons without AI.

### Phase P1 — First Wikidata pack (proof of generalization)

Detailed action plan: **[wikidata-tag-packs-planning.md](wikidata-tag-packs-planning.md)** (language/script × period partitions, SPARQL prototypes → dump extractor → tag strings + Q-id sidecar for disambiguation).

1. Build **`wikidata-persons-zh-Hant`** via WDumper or SPARQL script (~50k–200k strings, not millions)  
2. Same compile/load/matcher path as CBDB  
3. Document build recipe in repo for reproducibility  

**Exit:** demonstrates non-Chinese-specific pipeline; Japanese pack reuses tooling.

### Phase P2 — GeoNames + CHGIS place packs

1. **`geonames-places-CN`** (population filter e.g. cities5000 + alternates)  
2. **`chgis-places-historical`** (academic license banner in UI)  

**Exit:** place tagging coverage for modern + historical Chinese toponyms.

### Phase P3 — Japanese (NDL)

1. Parse NDL name authority batch or SPARQL export  
2. Gate packs when `project language = ja*`  

### Phase P4 — AI polish (parallel, smaller)

1. Fix audit retag (prompt + UI + apply)  
2. Optional prompt profile UI + automated tuning lab  
3. AI suggest only as “fill gaps” button after pack run  

### Explicitly deferred

- THL bulk pack without partnership  
- VIAF-as-tag-source (use at disambiguation)  
- Full Wikidata dump in-app  
- Appointment / event encoding standard  
- Live scraping Wikipedia/VIAF web UI  

---

## 10. Risks & open questions

| Risk | Mitigation |
|------|------------|
| **Ambiguous strings** (王, 洛阳) | `minLength` ≥ 2; period filter; review walk; context gates (future, Chinese-only) |
| **Pack size / memory** | Compile to NDJSON; load selected packs only; date filter before automaton build |
| **License violation** | manifest.json per pack; UI shows attribution; no commercial CHGIS redistribution in pack |
| **Stale VIAF/Wikidata** | Versioned packs; update badge; never silent replace |
| **User TEI disagreement** | Project tagging guide; audit suggests, never auto-applies without review |
| **Model churn** | Prompt profiles per model; tag bomb unaffected |

**Open questions for DPM:**

1. Pre-ship packs in app installer vs download-on-first-use only?  
2. Host packs on HuggingFace/GitHub releases vs LJB CDN?  
3. Include CBDB altname type 0 (“unknown”, ~45k strings)?  
4. Office strings: ship as `roleName` tag list even without standoff entity?  
5. Wikidata pack: filter by occupation (scholar/buddhist) or take all zh-label humans?  

---

## 11. Relationship to existing docs

| Document | Role |
|----------|------|
| [authority-databases-planning.md](authority-databases-planning.md) | CBDB + DILA field-level detail (still authoritative for Chinese) |
| [authority-databases-phases.md](authority-databases-phases.md) | Implementation checklist A0–A5 |
| [Auto-tagging.md](Auto-tagging.md) | Suggestion object, AI mode, matcher performance |
| [Auto-tagging-phases.md](Auto-tagging-phases.md) | Phase 4a seed / 4b disambiguation / Phase 5 AI |
| **This doc** | Strategic priority + multi-source pack feasibility |

---

## 12. One-line strategy

**Download curated authority packs → tag bomb → review → disambiguate → use AI only for what the lists missed.**

That is the same Norbert/MARKUS insight, built on infrastructure you already have — without waiting for perfect prompts, perfect TEI norms, or every language at once.
