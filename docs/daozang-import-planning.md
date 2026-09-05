# Daozang import — planning

**Status (2026-08-28):** **Import path done** — bundled 方瞳子 UTF-8 corpus (~1,513 texts), local search index, **File → Import from Daozang…**, optional install from local RAR/extracted folder. **Concordance done** — Kanripo import plugin ships `kanripo_daozang_map.json` (1,483 KR → bundled `rel_path` hits). **UI wiring partial** — Kanripo import wizard auto-loads matched Daozang text when parallel mode and both plugins are enabled; manual Daozang search picker still open.  
**Testing:** [kanripo-daozang-testing.md](kanripo-daozang-testing.md) (automated + manual checklist for this stage).  
**Related:** [kanripo-import-plugin-planning.md](kanripo-import-plugin-planning.md) (parallel punctuation engine, Phase 3b), `plugins/packages/plugin-daozang-import/`, `plugins/packages/plugin-kanripo-import/data/concordance/`.

---

## Goal

When the plugin is enabled:

1. **File → Import from Daozang…** opens a search dialog.
2. The user finds a text by title (or future DZ number) in the bundled corpus.
3. Grognard converts the selected UTF-8 `.txt` to schema-valid project TEI and writes it under e.g. `imported/daozang/`.

Secondary goal (concordance ready, UI not wired): when importing a **Kanripo** Dao work, offer the matching bundled Daozang transcription as a **parallel punctuation** source — same tape engine as Wikisource, no network fetch.

---

## What ships today

| Piece                             | Location                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Bundled UTF-8 texts               | `plugin-daozang-import/data/corpus/utf8/` (~77 MB, gitignored until built)     |
| Search index                      | `data/corpus/index.json` — `id`, `title`, `variant`, `rel_path`, `bytes`       |
| Index builder                     | `python/daozang_import/corpus_index.py`                                        |
| Mandoku-style → TEI body          | `python/daozang_import/daozang_tei.py`                                         |
| Desktop IPC                       | `daozang:search`, `daozang:resolveText`, `daozang:status`, corpus install/sync |
| Wizard UI                         | Grognard host module `daozangImportUi`                                         |
| **Kanripo ↔ Daozang concordance** | `plugin-kanripo-import/data/concordance/` (see below)                          |

Provenance: **方瞳子源** (Fang Tongzi / homeinmists.com) transcriptions of the Zhengtong and Wanli Supplement Daozang.

Maintainers rebuild the corpus with:

```bash
cd plugins/packages/plugin-daozang-import
node scripts/build-corpus-data.mjs --from-utf8 ~/path/to/道藏_txt
```

Then refresh the Kanripo crosswalk (after corpus index changes):

```bash
npm run build:concordance -w @grognard/plugin-kanripo-import
```

---

## Concordance (Kanripo import plugin)

The crosswalk lives in **`plugin-kanripo-import`**, not in the Daozang plugin — Daozang owns the texts; Kanripo import owns the lookup at import time.

| File                            | Role                                                                     |
| ------------------------------- | ------------------------------------------------------------------------ |
| `krp_dz_collation.csv`          | Work-level KR_ID ↔ DZID (~1,501 Daoist texts; `chinese_corpus_metadata`) |
| `kanripo_org_concordance.csv`   | Kanripo.org catalogue ↔ CBETA / DZID                                     |
| `dz_corpus_works.csv`           | DZID ↔ Fang Tongzi corpus filename                                       |
| `duren_jing_index.csv`          | Curated Duren jing KR ↔ DZ paths (`dz_krp/index.csv`)                    |
| `kanripo_daozang_map.json`      | **Runtime map:** KR_ID → bundled Daozang `rel_path` (1,483 entries)      |
| `kanripo_daozang_overrides.csv` | Manual overrides (maintainer-edited)                                     |
| `manifest.json`                 | Pack metadata and row counts                                             |

Python: `kanripo_import.concordance.lookup_daozang_rel_path("KR5a0031")` → `DaozangMapEntry` with `dz_id`, `daozang_rel_path`, `match_method`, etc.

Bridge (for host): JSON stdin `{ "op": "concordance_lookup", "kr_id": "KR5a0001" }` → `{ "kr_id", "dz_id", "daozang": { … } | null }`.

**You do not need a separate title index for matching** — the map joins upstream KR↔DZ tables to paths verified against the bundled Daozang `index.json`.

---

## Phase 2 — Kanripo parallel punctuation (UI wiring)

### User-facing flow (to implement)

1. User imports a Kanripo work (`KR5…` or any id with a map hit).
2. On the parallel punctuation step, if `concordance_lookup` returns a `daozang` entry and the Daozang plugin is enabled, Grognard shows **“Bundled Daozang match found”** with the matched title (or a search picker when ambiguous / override needed).
3. Host reads the `.txt` via `daozang:resolveText(rel_path)` and passes plain punctuated text to `parallel_punct.py` in **tape** mode (same as Wikisource).
4. Coverage bar and apply behave like any other parallel source.

### Rollout

| Step   | Status                                                                       |
| ------ | ---------------------------------------------------------------------------- |
| **2a** | Concordance tables + map + Python lookup                                     | **Done**      |
| **2b** | Kanripo import UI: auto-offer Daozang parallel when map hit + corpus present | **Done**      |
| **2c** | Manual fallback: “Load from Daozang corpus” via `daozang:search`             | **Not wired** |
| **2d** | Low-confidence / commentary matches → user confirm before apply              | **Open**      |

### Why not scrape or re-download?

The whole point of bundling is **offline, stable punctuation** for Dao texts without hitting third-party sites at import time. TEI conversion for full Daozang import and plain-text read for parallel punct share the same `.txt` files.

---

## Open questions

1. One Daozang file often covers a whole work; Kanripo splits by **juan** — overlap alignment already handles partial coverage; do we need per-juan slicing hints in the crosswalk?
2. Should `match_method` values other than `exact` / `duren_jing_index` / `override` require user confirmation (amber bar)?
3. ~18 KR↔DZ rows have no bundled Daozang hit — show empty bar + link to manual Daozang search?

---

## Test plan

**Concordance (done):**

```bash
pytest plugins/packages/plugin-kanripo-import/python/tests/test_concordance.py -q
```

**End-to-end parallel (when UI wired):**

1. `KR5a0031` 黃帝陰符經 + mapped 本文類 Daozang file → green coverage, punctuation copied.
2. `KR5a0087` (Duren jing commentary) → correct 四注 file from `duren_jing_index`.
3. No map hit → empty bar; import still succeeds in as-is mode.
