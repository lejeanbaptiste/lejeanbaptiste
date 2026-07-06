# Sanmiao ↔ LJB integration — source code audit

**Status:** Planning  
**Related:** `docs/Auto-tagging.md`, `docs/sanmiao-dates-schema.md`

---

## Summary

**Minimal-change path (recommended):** run sanmiao on **namespace-free text fragments**, return JSON suggestions to LJB; apply results into the live TEI tree from TypeScript (with correct TEI namespace on insert). This reuses existing internal functions with **one new sanmiao module** (~200 lines) and **almost no changes** to `tagging.py` / `xml_utils.py`.

**Full in-document path:** run `tag_date_elements` inside a TEI file with default namespace — requires a **medium refactor** (namespace-aware xpath, skip sets, element creation) across `tagging.py`, `xml_utils.py`, and parts of `bulk_processing.py`.

---

## What works today without modification

The `cjk_date_interpreter()` pipeline on **plain strings**:

```
tag_date_elements(text) → consolidate_date → remove_lone_tags → strip_text
→ index_date_nodes → extract_date_table_bulk → generate_report_from_dataframe
```

- Input wrapped in `<root>` — **no TEI namespace**.
- All elements created as unprefixed `date`, `year`, `era`, …
- `SKIP` / `skip_all_tags` compare `el.tag == "date"` — consistent in this mode.
- XPath `.//date`, `.//date[gz]` — works.
- Solving, proliferate, sequential implied state — unchanged.

**LJB can call this today** per text span or per paragraph batch extracted from the document.

---

## Namespace gaps (why in-TEI tagging is risky)

Partial namespace support exists only in:

| File | Function | What it does |
|------|----------|--------------|
| `bulk_processing.py` | `dates_xml_to_df` | If root has `{uri}tag`, uses `tei:` prefix in xpath for `date` and children |
| `tagging.py` | `index_date_nodes` | Same pattern for `.//tei:date` |

**Not namespace-aware** (uses `.//date`, `tag == "date"`, or unprefixed `findall`):

| File | Functions / areas |
|------|---------------------|
| `tagging.py` | `tag_date_elements`, `tag_basic_tokens`, `promote_gz_to_sexyear`, `promote_nmdgz`, `attach_suffixes`, rel attachment, `SKIP` sets, `et.Element("date")` creation |
| `xml_utils.py` | `remove_lone_tags`, `strip_text`, most of `replace_in_text_and_tail` |
| `bulk_processing.py` | `fix_dynasty_mismatch_xml` (partially OK via local-name split on `date`/`dyn` only) |

### Failure modes on TEI P5 (default namespace `http://www.tei-c.org/ns/1.0`)

1. **Existing `<date>` not found** — `.//date` does not match `{http://www.tei-c.org/ns/1.0}date`.
2. **Double tagging** — `skip_all_tags` checks `el.tag == "date"` but TEI date is `{uri}date`; skip fails.
3. **New elements in wrong namespace** — `et.Element("year")` creates no-namespace children inside TEI `<date>` → invalid mixed content for strict validators.
4. **`dates_xml_to_df` assumes TEI children** — xpath `.//tei:era` misses unprefixed `<era>` children sanmiao just created.
5. **`nmdgz` naming** — tagging creates `<nmdgz>`; NS xpath uses `.//tei:nmd_gz` (underscore) — typo breaks NM-date extraction in NS mode.

---

## Recommended integration: fragment bridge

### New sanmiao module: `ljb_bridge.py` (or `tei_bridge.py`)

Public API — no changes to core tagging logic required:

```python
def propose_dates(
    text: str,
    *,
    civ=None,
    sequential=True,
    fuzzy=True,
    tpq=-500,
    taq=2050,
    pg=False,
    gs=None,
    lang="en",
) -> list[dict]:
    """
    Tag + solve a plain-text or single-paragraph string.
    Returns JSON-serializable proposals per date_index:
      anchor_text, parse_xml, status, candidates[], sequential_context
    """
```

Implementation: copy the body of `cjk_date_interpreter` for Chinese spans, but return structured dicts instead of a report string. Group `output_df` by `date_index`; attach proliferate rows as `candidates`.

Optional:

```python
def propose_dates_document(
    paragraphs: list[str],
    **kwargs,
) -> list[dict]:
    """Sequential implied state across paragraphs in order."""
```

```python
def row_to_tei_attrs(row, *, pg, gs) -> dict[str, str]:
    """jdn canonical + derived when/notBefore/notAfter."""
```

```python
def parse_xml_from_dataframe_row(row) -> str:
    """Rebuild inner XML from df string columns for apply."""
```

LJB subprocess: `python -m sanmiao.ljb_bridge --json < config.json`

### LJB side (TypeScript)

1. Walk document text nodes (existing anchor / search-text policy).
2. Batch plain text to sanmiao → suggestions with `parseXml` + `candidates`.
3. **Apply** inserts into live TEI with correct namespace (LJB already owns XML mutation).
4. Re-resolve on existing markup: either re-tag from `normalize-space(string())` or read sanmiao children if present (call `dates_xml_to_df` on a wrapped fragment).

**Namespace handling stays in LJB apply**, not sanmiao — avoids refactoring the whole package.

---

## If you need in-document sanmiao later

Central helper module `sanmiao/ns.py`:

```python
TEI_NS = "http://www.tei-c.org/ns/1.0"

def local_name(tag: str) -> str: ...
def ns_map(root) -> dict: ...
def xpath_dates() -> str:  # local-name()=date
def make_element(parent, name, text=None):  # inherit parent namespace
```

Refactor targets (~15–25 call sites):

- Replace `.//date` with `.//*[local-name()="date"]` or registered `tei:` prefix from root.
- Replace `el.tag == "date"` with `local_name(el.tag) == "date"`.
- Replace `et.Element("year")` with `make_element(parent, "year")`.
- Extend `SKIP` checks to use `local_name`.
- Fix `nmd_gz` → `nmdgz` in NS xpath in `dates_xml_to_df`.

Estimated effort: **2–4 days** for namespace refactor + tests on TEI fixtures. Not required for v1 if using fragment bridge.

---

## Small sanmiao fixes worth doing regardless

| Fix | File | Effort |
|-----|------|--------|
| `tei:nmd_gz` → `tei:nmdgz` (or local-name) | `bulk_processing.py` | Trivial |
| Export `propose_dates` / `row_to_tei_attrs` | new `ljb_bridge.py` | Small |
| Unit test: TEI-namespaced `<date>` round-trip via fragment | `tests/test_ljb_bridge.py` | Small |

---

## Re-resolve on corpus XML with sanmiao children

When the edition already has parse children inside TEI `<date>`:

1. Extract each `<date>` subtree as string.
2. Wrap in `<root xmlns="…">` **or** strip namespaces to sanmiao-native fragment.
3. `index_date_nodes` + `extract_date_table_bulk(..., attributes=True)` if attrs present.
4. Return candidates to resolve UI.

Reading **in place** is now supported via `local-name()` xpath and TEI-aware tagging (sanmiao 0.2.8+). LJB may still prefer extract/wrap for apply-round-trip control.

---

## Implemented in sanmiao (2026-07)

| Module | Purpose |
|--------|---------|
| `sanmiao/ns.py` | `local-name()` xpath, `is_tag`, `detect_wrapper_namespace`, `strip_namespaces` |
| `sanmiao/tei_bridge.py` | `propose_dates()`, `resolve_date_element()`, `row_to_tei_attrs()` |
| `dates_xml_to_df` | Namespace-agnostic child extraction (fixes `nmdgz` xpath typo) |
| `tagging.py` | Skip/wrap uses local names; TEI `<date>` wrappers when tagging inside TEI |
| `xml_utils.py` | `remove_lone_tags`, `strip_text` namespace-aware |

Tests: `sanmiao/tests/test_tei_ns.py` (run with `PYTHONPATH=src pytest`).

---

## Editable dev install (tweak sanmiao + LJB together)

Keep `sanmiao` as a **sibling folder** of `leaf-writer` (e.g. `~/Code/sanmiao` beside `~/Code/leaf-writer`). LJB auto-detects that checkout and uses its venv — not the PyPI copy in system Python.

**One-time setup** (in the sanmiao repo):

```bash
cd ~/Code/sanmiao
python3 -m venv .venv
.venv/bin/pip install -e ".[fuzzy]"
```

Verify:

```bash
.venv/bin/python -c "import sanmiao; print(sanmiao.__file__)"
# should print …/sanmiao/src/sanmiao/__init__.py
```

**Day to day:** edit files under `sanmiao/src/sanmiao/`, restart or re-run auto-tagging in LJB — no reinstall. Each tagging run spawns a fresh Python subprocess that loads your current source.

**Optional:** pin a specific interpreter if the sibling layout differs:

```bash
export SANMIAO_PYTHON=~/Code/sanmiao/.venv/bin/python
```

Launch LJB from a shell with that variable set, or add it to your desktop app environment.

**Tests** after changing sanmiao:

```bash
cd ~/Code/sanmiao
PYTHONPATH=src .venv/bin/python -m pytest tests/test_tei_ns.py -q
```

---

## Decision matrix

| Approach | Sanmiao changes | Namespace risk | Re-resolve stored parse |
|----------|-----------------|----------------|-------------------------|
| **Fragment bridge (v1 LJB)** | `tei_bridge.py` | Low | `resolve_date_element()` |
| **In-document tagging** | Done in core (ns helpers) | Low–medium | Native |
| **Paragraph batch with implied carry** | `propose_dates_batch()` passes `implied` from chunk to chunk when `sequential=True` (0.2.10+) | LJB sends one `<p>` per chunk; cross-paragraph 其三年 still resolves |

**Recommendation:** LJB calls `propose_dates()` / `resolve_date_element()` via subprocess; apply TEI mutations in TypeScript. Sanmiao core is now TEI-capable for standalone batch use too.
