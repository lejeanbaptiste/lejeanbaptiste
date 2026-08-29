# Kanripo + Daozang import — testing guide (2026-08-29)

**Stage:** Phase 3b — bundled Daozang corpus, standalone Daozang import, Kanripo ↔ Daozang concordance, parallel punctuation (tape + segmented), import quality warnings, TEI schema merge v14.

**Related planning:** [kanripo-import-plugin-planning.md](kanripo-import-plugin-planning.md), [daozang-import-planning.md](daozang-import-planning.md).

**Out of scope for this pass:** direct Ctext API import, CBETA auto-parallel, per-juan Wikisource fetch when 卷 ≠ juan. **Phase 4 AI punctuation:** shipped (v3 + editor selection); **AI fill gaps** after parallel import (see §2.8).

---

## Prerequisites

### Repos and build

- Sibling checkouts: `leaf-writer`, `plugins` (with `plugin-kanripo-import`, `plugin-daozang-import`).
- Daozang bundled corpus present: `plugins/packages/plugin-daozang-import/data/corpus/index.json` (~1,513 texts).
- Kanripo concordance present: `plugins/packages/plugin-kanripo-import/data/concordance/kanripo_daozang_map.json` (~1,483 KR hits).

### Desktop dev run

```bash
cd leaf-writer
npm run dev:desktop
```

Fully quit and restart after pulling schema or dialog fixes (Electron main + commons webpack both need to reload).

### Plugins (in app)

Open **Tools → Plugins** (or Settings → Plugins) and enable for the test project:

- [x] **Kanripo import**
- [x] **Daozang import**

### Test project

Use a TEI All or TEI Lite project with a local schema. After schema-merge fixes, reopen the project and confirm the console does **not** show RelaxNG compile errors. In `schema/tei_all.rng` (or your wrapper), look for:

`ljb-sanmiao-merge v14` (or later)

and no duplicate `@type` on the Kanripo `<g type="kanripo">` branch.

---

## Part 1 — Automated tests (CLI)

Run these before manual UI testing. All should pass.

### 1.1 Leaf Writer — schema merge

```bash
cd leaf-writer
npx jest apps/desktop/src/sanmiaoSchemaMerge.test.ts --silent
```

**Expect:** all tests pass; merged RNG has Kanripo gaiji override without duplicate `@n` or `@type` on the `type=kanripo` branch.

### 1.2 Daozang plugin — Python

```bash
cd plugins/packages/plugin-daozang-import
PYTHONPATH=python python3 -m unittest discover -s python/tests -q
```

**Covers:** GB-family decoding, TEI body conversion, corpus index ids (unique for Chinese filenames), install/sync helpers.

### 1.3 Daozang plugin — smoke

```bash
cd plugins/packages/plugin-daozang-import
node scripts/smoke-test.mjs
```

**Expect:** manifest OK, `register()` wiring OK, Python tests OK.

### 1.4 Kanripo plugin — Python

```bash
cd plugins/packages/plugin-kanripo-import
PYTHONPATH=python python3 -m unittest discover -s python/tests -q
```

**Covers:** `parallel_punct.py` (tape + segmented), concordance lookup, quality warnings (`no_overlap`, `daozang_no_align`, `low_overlap`, `low_punctuation`).

### 1.5 Kanripo plugin — Wikisource fetch (unit)

```bash
npm run test:wikisource -w @ljb/plugin-kanripo-import
```

**Expect:** MediaWiki URL parsing and chapter-page preference tests pass (no network required for unit tests).

### 1.6 Kanripo plugin — smoke

```bash
cd leaf-writer
npm run build:kanripo-import   # if dist stale
npm run smoke:kanripo-import
```

### 1.7 Optional — batch parallel (needs Kanripo files on disk)

Requires a cloned Kanripo work directory (e.g. from Kanripo.org) and network for Wikisource/ctext fetch:

```bash
# Wikisource + 荀子 (tape mode regression)
npm run test:parallel-batch -w @ljb/plugin-kanripo-import -- \
  --kanripo /path/to/KR3a0002 \
  --wikisource-url 'https://zh.wikisource.org/zh-hant/荀子/勸學篇'
```

**Expect:** per-juan well-formed XML; overlap/coverage reported; no Python tracebacks.

Concordance lookup (no GUI):

```bash
cd plugins/packages/plugin-kanripo-import
PYTHONPATH=python python3 -c "
from kanripo_import.concordance import lookup_daozang_rel_path
for kr in ('KR5a0001', 'KR5a0087', 'KR3a0002'):
    hit = lookup_daozang_rel_path(kr)
    print(kr, '->', hit.daozang_rel_path if hit else None)
"
```

**Expect:** `KR5a0001` and `KR5a0087` return bundled `rel_path` strings; `KR3a0002` (荀子, not Dao) typically returns `None`.

---

## Part 2 — Manual desktop tests

Use checkboxes to record passes. Note macOS version and app build (dev vs packaged).

### 2.1 Schema and validator

- [x] Open test project → console free of `RelaxNG schema failed to compile` / duplicate `@type` errors
- [x] Open an imported or sample TEI file → validation panel loads (not stuck on schema error)
- [x] Optional: open a file with `<g type="kanripo">` gaiji → inline graphic renders

### 2.2 Standalone Daozang import

**File → Import from Daozang…**

- [x] Dialog opens (search field, corpus status banner)
- [x] Banner shows bundled corpus ready (~1,513 texts) when Daozang plugin enabled
- [x] Search by Chinese title returns hits; list rows have **unique** keys (no React duplicate-key warnings in console)
- [x] Select a text → **Import selected** → file written under `imported/daozang/` in project root
- [x] New file opens in a tab; XML is well-formed; validator accepts document
- [x] Imported text is readable (not mojibake — GB decoding worked)

**Regression:** menu click with project closed → snackbar “Open a project first” (not silent).

### 2.3 Kanripo import — as-is (no parallel)

**File → Import from Kanripo…**

- [x] Search/select a small work (e.g. single-juan test if available)
- [x] Import without parallel punctuation → TEI under `imported/kanripo/<KR_ID>/`
- [x] Gaiji PNGs copied to `_gaiji/` when present; `<g type="kanripo">` validates

### 2.4 Kanripo import — Wikisource parallel (tape mode)

**Suggested work:** `KR3a0002` 荀子 — use the **work index URL** `https://zh.wikisource.org/zh-hant/荀子` (Fetch URL on import loads the chapter catalog; each juan is matched by 篇 title, with Han-overlap fallback).

- [x] Parallel punctuation enabled
- [x] Wikisource root URL fetched (status shows chapter count, e.g. “33 chapters”)
- [x] Import completes; juan 1 (勸學篇) shows punctuation and non-zero coverage
- [x] Commentary notes (`<note type="comm">`): each Wikisource `〈…〉` block punctuates **one** comm note (second pass after tape mode strips brackets from main-text alignment)
- [x] Import report shows coverage; yellow warnings if overlap is poor

### 2.5 Kanripo import — bundled Daozang parallel (Phase 3b)

**Suggested Dao works (concordance hits):**

| KR id      | Title (short)        | Notes                         |
| ---------- | -------------------- | ----------------------------- |
| `KR5a0001` | 靈寶無量度人上品妙經 | Strong map hit                |
| `KR5a0087` | 度人經四註           | Commentary / variant filename |

**Not expected to auto-match Daozang:** `KR3a0002` (荀子) — use Wikisource instead.

With **both** Kanripo and Daozang plugins enabled and **parallel punctuation** selected:

- [x] On work select, **Bundled Daozang (方瞳子)** panel shows concordance match (or clear “no match” message)
- [x] **Load concordance match** loads punctuated parallel text (character count in status)
- [x] Manual Daozang search picker can load an alternate `.txt` as parallel source
- [x] Full import applies punctuation from Daozang tape onto Kanripo body
- [x] Per-juan **quality warnings** in report when appropriate:
  - `no_overlap` — parallel text unrelated
  - `daozang_no_align` — Daozang-specific mismatch
  - `low_overlap` — overlap &lt; 30%
  - `low_punctuation` — high overlap but few punctuation marks copied

### 2.6 Segment-and-punctuate (open file only)

- [x] Open an already-imported Kanripo juan
- [x] Toolbar / command **Segment and punctuate** (Kanripo plugin)
- [x] Attach parallel source (paste, file, or Daozang) → preview → apply on **current file only**

### 2.7 AI punctuation (manual smoke)

Prerequisites: Kanripo import plugin enabled; **App Settings → AI API** configured and connection tested (Ollama e.g. `ministral-3:latest` or `qwen2.5:14b`).

- [x] **Import:** File → Import from Kanripo → Punctuation = **AI inference (no parallel)** → one short juan imports with marks; header `revisionDesc` notes model + prompt **v3** (`ai-punct-v3`)
- [x] **Editor:** open imported juan → **Tools → AI punctuate selection** (or Kanripo toolbar → same; whole juan if no selection) → marks appear; Han text unchanged; progress in bottom bar (`AiRunIndicator`)
- [x] **Purge gate:** select punctuated stretch → AI punctuate → confirm **purge** dialog → re-punctuate succeeds (only marks in selection removed)
- [x] **Purge command:** Tools → **Purge punctuation** → marks removed; Han preserved
- [x] **Reflow:** after punctuation → Tools → **Reflow paragraphs** → `<p>` splits at sentence boundaries (basetext only)
- [x] Comm notes (`<note type="comm">`) punctuated separately; no paragraph breaks inside notes

### 2.8 AI fill gaps (after parallel import)

Prerequisites: parallel import completed (§2.5–2.6); coverage bars show grey areas; AI configured (§2.7).

- [ ] **Import:** parallel mode only — multi-juan work finishes in reasonable time (no AI during import)
- [ ] **Import screen:** parallel import → grey on bar → **Fill gaps** on that juan (stays in dialog)
- [ ] **Toolbar:** Kanripo → **AI fill gaps…** on open juan (no duplicate Tools menu entries)
- [ ] **Dao work:** KR5a0087 juan with high parallel coverage — AI runs on few or no segments
- [ ] **Classic work:** KR1f0006 — AI fills commentary gaps after parallel

### 2.9 Plugin enable/disable

- [x] Disable Daozang plugin → File menu item hidden or import shows enable message
- [x] Re-enable → registry refresh → import works without full app restart (if not, note as bug)

---

## Part 3 — What “good” looks like

### Daozang standalone import

- Output: one TEI file per selected 方瞳子 text, skeleton from project schema, body as `<div type="text">` with `<head>` and `<p>` paragraphs.
- Provenance in header / sourceDesc referencing Fang Tongzi transcription.

### Kanripo + Daozang parallel

- Kanripo body keeps Kanripo line/page structure where possible; punctuation marks (`。、；：「」` etc.) copied from Daozang onto aligned Han characters.
- Daozang `.txt` is **punctuated**; Kanripo source is typically **unpunctuated** — the engine aligns and transfers punctuation only.
- Imperfect alignment on variant-heavy or commentary-heavy texts is expected; quality warnings flag suspicious juans.

### Schema

- Validator worker compiles project TEI RelaxNG without duplicate-attribute errors.
- Kanripo gaiji: `<g type="kanripo">` may contain `<graphic url="_gaiji/…"/>`.

---

## Part 4 — Known limitations (not failures)

| Limitation                                                      | Workaround                                                                                                                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concordance covers ~1,483 Dao KR ids, not all Kanripo works     | Wikisource, paste, or file parallel                                                                                                                                                |
| 荀子 etc. (non-Dao) — no Daozang auto-match                     | Use Wikisource chapter URL                                                                                                                                                         |
| Multi-juan work vs single Daozang file — overlap may be partial | Check per-juan warnings; manual parallel per juan                                                                                                                                  |
| Bundled corpus filenames are Chinese; index uses hashed ids     | Search by title, not by id slug                                                                                                                                                    |
| Per-juan Wikisource when 卷 ≠ juan                              | Not built yet — whole-work or chapter URL only                                                                                                                                     |
| Phase 4 AI punctuation                                          | Shipped — **parallel import** then **Fill gaps** per juan on the import screen, or Kanripo toolbar → **AI fill gaps**. **AI inference** import mode punctuates whole juans (slow). |

---

## Part 5 — Recording results

Copy this block into a PR comment or session note:

```
Date:
Tester:
App: dev:desktop / packaged build ___
OS: macOS ___

Automated:
- [x] sanmiaoSchemaMerge jest
- [x] daozang python + smoke
- [x] kanripo python + wikisource + smoke
- [ ] optional parallel-batch: ___

Manual:
- [x] Schema / validator clean
- [x] Daozang import dialog + write + open
- [ ] Kanripo as-is import
- [ ] Kanripo + Wikisource (KR3a0002 勸學篇)
- [ ] Kanripo + Daozang auto-load (KR5a0001 or KR5a0087)
- [ ] Quality warnings seen when expected: ___

Issues:
-
```

---

## Part 6 — If something fails

| Symptom                                               | First checks                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| File → Import from Daozang does nothing               | Plugins enabled? Project open? Console `[plugins] Failed to load daozang-import`? Restart `dev:desktop`. |
| Dialog opens but list duplicates / React key warnings | Refresh index in dialog or restart app (index v2 with hashed ids).                                       |
| Python import error / mojibake                        | Daozang `.txt` GB decoding — rerun `plugin-daozang-import` python tests.                                 |
| Schema compile error in console                       | Reopen project; confirm `ljb-sanmiao-merge v14+` in `schema/tei_all.rng`.                                |
| No Daozang match in Kanripo wizard                    | KR id in `kanripo_daozang_map.json`? Both plugins enabled? Parallel mode on?                             |
| Punctuation wrong but import “succeeds”               | Check yellow quality warnings; try Wikisource or manual parallel for comparison.                         |

For debugging, useful console filters: `[plugins]`, `[plugin-python:daozang-import]`, `[validator]`, `[dialog]`.
