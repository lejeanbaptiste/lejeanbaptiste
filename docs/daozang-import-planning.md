# Daozang import — planning

**Status (2026-08-28):** **Import path done** — bundled 方瞳子 UTF-8 corpus (~1,513 texts), local search index, **File → Import from Daozang…**, optional install from local RAR/extracted folder. **Kanripo parallel integration not started** — reuse this corpus as offline punctuated parallels for `KR5*` works (see Phase 2 below).  
**Related:** [kanripo-import-plugin-planning.md](kanripo-import-plugin-planning.md) (parallel punctuation engine), plugin package `plugins/packages/plugin-daozang-import/`.

---

## Goal

When the plugin is enabled:

1. **File → Import from Daozang…** opens a search dialog.
2. The user finds a text by title (or future DZ number) in the bundled corpus.
3. LJB converts the selected UTF-8 `.txt` to schema-valid project TEI and writes it under e.g. `imported/daozang/`.

Secondary goal (not yet implemented): when importing a **Kanripo** Dao work, offer the matching bundled Daozang transcription as a **parallel punctuation** source — same tape engine as Wikisource, no network fetch.

---

## What ships today

| Piece | Location |
| ----- | -------- |
| Bundled UTF-8 texts | `plugin-daozang-import/data/corpus/utf8/` (~77 MB, gitignored until built) |
| Search index | `data/corpus/index.json` — `id`, `title`, `variant`, `rel_path`, `bytes` |
| Index builder | `python/daozang_import/corpus_index.py` |
| Mandoku-style → TEI body | `python/daozang_import/daozang_tei.py` |
| Desktop IPC | `daozang:search`, `daozang:resolveText`, `daozang:status`, corpus install/sync |
| Wizard UI | LJB host module `daozangImportUi` |

Provenance: **方瞳子源** (Fang Tongzi / homeinmists.com) transcriptions of the Zhengtong and Wanli Supplement Daozang.

Maintainers rebuild the corpus with:

```bash
cd plugins/packages/plugin-daozang-import
node scripts/build-corpus-data.mjs --from-utf8 ~/path/to/道藏_txt
```

---

## Corpus index — what it is and is not

The bundled **`index.json` is sufficient for search and import**. Users can already find texts by title substring in the Daozang import dialog.

It is **not** sufficient on its own for automatic Kanripo parallel matching:

| Field | Today | Needed for Kanripo crosswalk |
| ----- | ----- | ---------------------------- |
| `title` | Long filename stem (e.g. `正統道藏洞真部本文類-黃帝陰符經`) | **Normalized `short_title`** (e.g. `黃帝陰符經`) |
| `dz_no` | Empty (filenames lack DZ numbers) | Optional if future corpus adds DZ prefixes |
| `variant` | Parsed from path (本文類, 玉訣類, …) | Rule: prefer **本文類** for base Kanripo texts |
| Kanripo id | — | **`kanripo_daozang_map.json`**: `KR5a0031` → `rel_path` |

**Do not build a second full title index.** Extend the existing builder and generate a crosswalk offline.

---

## Phase 2 — Kanripo parallel punctuation (planned)

### User-facing flow

1. User imports a Kanripo work (`KR5…` or any id with a crosswalk hit).
2. On the parallel punctuation step, LJB shows **“Bundled Daozang match found”** (or a search picker when ambiguous).
3. Selected `.txt` is read as plain punctuated text and passed to `parallel_punct.py` in **tape** mode (same as Wikisource).
4. Coverage bar and apply behave like any other parallel source.

### Matching strategy (offline script)

1. Load `krp_works.json` (Kanripo titles) and `index.json` (Daozang entries).
2. Extract `short_title` from Daozang stems (strip `正統道藏…部…類-` prefix).
3. Match Kanripo `title` to Daozang `short_title` (exact, then normalized/fuzzy).
4. When multiple Daozang files match, prefer **`本文類`** for base Kanripo works; use author/dynasty from Kanripo when disambiguating commentaries.
5. Write `data/kanripo_daozang_map.json`; allow **`kanripo_daozang_overrides.csv`** for manual fixes.

### Rollout

| Step | Description |
| ---- | ----------- |
| **2a** | Manual picker in Kanripo import — “Load from Daozang corpus” reuses `daozang:search` + `daozang:resolveText` |
| **2b** | Ship crosswalk; auto-suggest when confidence is high |
| **2c** | Optional: enrich index with DZ numbers if corpus filenames are upgraded |

### Why not scrape or re-download?

The whole point of bundling is **offline, stable punctuation** for Dao texts without hitting third-party sites at import time. TEI conversion for full Daozang import and plain-text read for parallel punct can share the same `.txt` files.

---

## Open questions

1. One Daozang file often covers a whole work; Kanripo splits by **juan** — overlap alignment already handles partial coverage; do we need per-juan slicing hints in the crosswalk?
2. Should low-confidence auto-matches require user confirmation (amber bar)?
3. When Kanripo id maps to a **commentary** edition, should we link to the matching 玉訣類 file instead of 本文類?

---

## Test plan (when Phase 2 lands)

1. `KR5a0031` 黃帝陰符經 + 本文類 Daozang file → green coverage, punctuation copied.
2. Ambiguous title → picker, no silent wrong edition.
3. Commentary Kanripo id → 玉訣類 match when crosswalk says so.
4. No match → empty bar; import still succeeds in as-is mode.
