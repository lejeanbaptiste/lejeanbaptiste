# CBETA import — planning & schema-translation analysis

**Status (2026-08-31):** Design + working single-family importer. Plugin
`plugins/packages/plugin-cbeta-import/` (hybrid, from the kanripo/daozang
template): implemented + tested — juan splitter, the four decided in-place
reductions, **`corpus_sync`** (git clone/fetch at the pinned tag +
`install_from_source` from clone/dir/zip/tar), **`catalog_index`** (scan the
checkout → work id / title / dynasty / juan count, multi-file grouping, search,
`resolve_work_files`), the multi-file `<body>` concat, and **`metadata_xml`**
(CBETA-header extraction + byline→dynasty/names/role parser + `work_info.json`
enrichment with DILA / Norbert / Wikidata ids; `convert` now returns
`title` / `dynasty` / `category` / `taisho_vol·no` / `authorship[]` / `work_qid`).
**`build-cbeta-metadata.py`** builds `work_info.json` + the rich
`catalog_index.json` from `Authority-Databases/authority_catalog` (title,
dynasty, 部類, juans, contributors → DILA ids) merged with a corpus scan for
file grouping, with optional `--crosswalk` (DILA→Norbert/Wikidata) and
`--authority-person` (dates, QIDs) enrichment; every input is optional and a
no-arg run writes placeholders. Host UI wired end-to-end (File-menu item,
`CbetaImportDialog`, host module, `cbetaImportXml.ts` → `<author ref=…>`,
`LJB_PLUGIN_CACHE_PATH` in the desktop bridge) and typechecks.
**Cross-family downgrades** (§5.1–5.6) are implemented in
`python/cbeta_import/downgrade.py`: `cb:yin`/`cb:fan`/`cb:sg`→`<note
type="gloss">` (unconditional), and when the target project is not
CBETA-family — `cb:tt`/`cb:t`→`<seg subtype>`, `cb:juan`→drop-open/`<trailer>`,
`cb:div`→`div` + `cb:mulu`→`<div>` nesting (bare) or `<milestone unit="mulu">`
breadcrumb (when divs already present), `cb:*` attrs→plain TEI / drop,
`cb:docNumber`→`<label>`, `cb:dialog`→`<div>`. Output carries zero `cb:`.
**§4 schema loosenings** are implemented in `scripts/loosen_schema.py` (called
by `build-cbeta-metadata.py --schema`): CBETA's flat `cbeta-p5.rng` gets
`@ref`/`@key` on `title`/`author`/`byline`/NE (guarded against existing
declarations), the NE inventory added to `tei_model.phrase`, and `<date>`
extended with the Sanmiao parse children + resolution attributes (kept in sync
with `apps/desktop/src/sanmiaoSchemaMerge.ts`). Idempotent; the output compiles
as RelaxNG and validates tagged docs stock CBETA rejects. CBETA's Schematron
(3 rules, all `@spanTo` requirements) is unaffected and passes through.
**Per-juan apparatus** (§5.5) is carried: each juan file emits
`<text><body>…</body><back>…</back></text>` with the `<back>` pruned to the
`<app>`/`<note>` entries whose ids occur in that juan. **Multi-file works**
(§5.7): `prefix_ids` namespaces file 2..N's `xml:id`s + pointers so nothing
collides, and `stitch_cross_file_juan` merges adjacent slices that share a juan
`@n` — a juan re-anchored by a repeated `<milestone>`/`<cb:juan>` in the next
file — dropping the duplicate markers; unmarked continuation content is already
folded into the previous juan by the split. **The bundled metadata has been
built** from `Authority-Databases` + the DILA→Norbert crosswalk:
`data/metadata/{work_info,catalog_index}.json` cover 5,631 works (4,265 with a
DILA person id, 756 with a Norbert id, 2,847 with dates), and
`data/schema/cbeta_p5.rng` is CBETA's grammar + the §4 loosenings. File
grouping is filled from a GitHub tree listing (`build:metadata --file-list`, no
checkout): **5,623/5,631 works have a resolved file list**, multi-volume works
included (`T0220`→15 files, `L1557`→4). Remaining gaps: 8 obscure works absent
from the xml-p5 tree; `cb_gaiji.json` is empty (per-file `<charDecl>` is the
runtime source). Sibling of
[import-planning.md](import-planning.md),
[kanripo-import-plugin-planning.md](kanripo-import-plugin-planning.md),
[bdrc-import-planning.md](bdrc-import-planning.md) (explored in parallel; live
PDI fetch, not a bundled corpus),
[ljb-tei-extensions.md](ljb-tei-extensions.md). Ship target: 2026-09-09 for a
first one-way importer; the round-trip layer (§8) is a later phase.

---

## 1. Decisions already taken

| #                  | Decision                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source             | Corpus from GitHub: `DILA-edu/cbeta-xml-p5` (public P5) + `DILA-edu/cbeta-metadata` (`work-info/`, `gaiji/`, `variants/`, `goto/`) + the split-out catalog repo. Bundled under the plugin's `data/`, resolved via `LJB_PLUGIN_INSTALL_PATH`, **no network at import time** (kanripo discipline). Pin the CBETA data-version tag (currently `2026R2`) + git commit. |
| API                | Left out. Optional build-time only: assembled TOC JSON, and as a reference oracle to check our byline parser. Never a runtime dependency.                                                                                                                                                                                                                          |
| Split unit         | **By juan.** Cut at `<milestone unit="juan"/>` / `<cb:juan fun="open"/>…fun="close"/>` pairs.                                                                                                                                                                                                                                                                      |
| Import scope       | Full-work **or** single-juan, like the Kanripo plugin (work id → all juan; one juan URL → one 卷).                                                                                                                                                                                                                                                                 |
| Empty milestones   | `<lb/>`, `<pb/>`, `<anchor/>` kept as-is. Base edition only on `lb`/`pb` (drop non-canonical `@ed` where a text carries several — see §5.6).                                                                                                                                                                                                                       |
| 夾註 commentary    | `<note place="inline">` (and `interlinear`, `inline2`) is **authorial text**. Kept inline, verbatim, untouched — never externalised.                                                                                                                                                                                                                               |
| `<g>` gaiji        | Resolved to Unicode at import where `<charDecl>` supplies a codepoint; `<g>` + bundled glyph kept for the true residue (Siddhaṃ/Rañjana always).                                                                                                                                                                                                                   |
| `<app>` / `<rdg>`  | Already in `<back>` in public P5. Kept there as-is. Not folded back inline.                                                                                                                                                                                                                                                                                        |
| `<note>` apparatus | Keep `type="mod"` (with the `<app>`) + `add` / `cf*` / `equivalent` / `rest` in `<back>`. **`type="orig"` (Taishō's pre-CBETA wording) not carried** — recoverable from the pinned source. See §7.                                                                                                                                                                 |
| `@style`           | Indentation only (`margin-left`, `text-indent`) — **dropped on import**. `@rend` (only `no-marker`) kept.                                                                                                                                                                                                                                                          |
| X-canon line refs  | Keep the canon's own `@ed` stream; **drop `R135`/`R138` 新文豐 reprint `<lb>`/`<pb>`** unless a per-project 新文豐 flag is set. See §7.                                                                                                                                                                                                                            |
| Punctuation        | Kept as CBETA ships it. `<punctuation resp="…">` carried verbatim.                                                                                                                                                                                                                                                                                                 |
| Output path        | `imported/cbeta/<canon>/<vol>/<vol>n<no>_<juan>.xml` (mirrors CBETA tree + `_NNN` juan suffix).                                                                                                                                                                                                                                                                    |
| Target schema      | CBETA P5 is treated as a **peer of TEI-ALL** — a supported target schema. We import into it and insert the things we need (authority attributes, NE inventory) exactly as we would into TEI-ALL. No separate CBETA schema generator. See §4.                                                                                                                       |
| Phonetic gloss     | `<cb:yin>`/`<cb:zi>`/`<cb:sg>`/`<cb:fan>` downgraded: head characters stay inline, the reading becomes `<note type="gloss">` (`subtype="fanqie"` for 反切), handled like `<note type="comm">`. See §5.2.                                                                                                                                                           |
| TOC                | Left implicit in `<div>` nesting + `<head>`. No generated `<front>` contents list.                                                                                                                                                                                                                                                                                 |
| Authority          | Translator/author resolved to Norbert/DILA authority **at import** (`@ref`/`@key` in the header respStmt), plain text when no id; re-checkable in a later pass.                                                                                                                                                                                                    |

---

## 2. What "translation" means here

Two distinct paths, only the first is in scope for 2026-09-09:

1. **CBETA → project (one-way, now).** Import one or more juan into whatever
   project is open. CBETA P5 is a supported target schema alongside
   TEI-ALL, so when the project already _is_ CBETA-family the markup is
   kept almost verbatim (we just insert what we need — §4). Importing
   CBETA content into a **different** family (TEI-ALL / jTEI / Orlando)
   triggers the lossy reductions in §5.
2. **Round-trip / cross-family (later).** TEI-ALL ⇄ CBETA ⇄
   Kanripo/Daozang, so a TEI-ALL project can pull two juan from CBETA _and_
   a CBETA project can pull a Kanripo or Daozang parallel. This needs the
   mapping to be **data, invertible, and versioned** (§8), not a one-shot
   script. Build the one-way importer in §5 on top of that mapping table
   from the start, even while only using it in one direction.

The rest of this document is the **inventory of what does not carry cleanly
into TEI-ALL**, with a recommendation for each.

---

## 3. What maps cleanly (no action beyond a rename)

| CBETA                                                                                                                                                        | TEI-ALL          | Note                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<cb:div type="…">`                                                                                                                                          | `<div type="…">` | TEI `<div>` allows free `@type`. CBETA only used `cb:div` for a looser content model. The `@type` vocab (`xu fen jing pin hui di she shi chu zhang xiang mu jie w orig commentary toc lg other 廣釋 續補`) carries across as-is. |
| `<lb/>` `<pb/>`                                                                                                                                              | same             | Core TEI-ALL. Legal inside inline elements.                                                                                                                                                                                      |
| `<anchor xml:id=…/>`                                                                                                                                         | same             | Core.                                                                                                                                                                                                                            |
| `<app from="#a" to="#b">` in `<back>`                                                                                                                        | same             | TEI-ALL double-end-point attachment. Already valid.                                                                                                                                                                              |
| `<lem>` `<rdg>` `<witDetail>`                                                                                                                                | same             | Core apparatus module.                                                                                                                                                                                                           |
| `<g ref="#…">` + `<charDecl>`/`<char>`/`<glyph>`                                                                                                             | same             | Core gaiji module.                                                                                                                                                                                                               |
| `<note>` `<choice>` `<corr>`/`<sic>` `<reg>`/`<orig>` `<unclear>` `<gap>` `<space>`                                                                          | same             | Core.                                                                                                                                                                                                                            |
| `<lg>` `<l>` `<caesura>` `<seg>` `<hi>` `<list>` `<item>` `<table>` `<row>` `<cell>` `<figure>` `<graphic>` `<bibl>` `<ref>` `<title>` `<quote>` `<foreign>` | same             | Core.                                                                                                                                                                                                                            |
| `<editorialDecl><punctuation resp="…">`                                                                                                                      | same             | Core (P5). Carry verbatim; surface `resp="AI"` downstream as machine-draft punctuation.                                                                                                                                          |
| `@ed` `@n` on `lb`/`pb`                                                                                                                                      | same             | Keep. Citation backbone (Taishō vol·page·register·line).                                                                                                                                                                         |

---

## 4. Inserting what we need into the CBETA schema

CBETA P5 is handled like TEI-ALL: a target schema we import into and then
widen just enough to hold our apparatus. Same treatment either schema —
no CBETA-specific generator, no new elements, only loosened content models
and permitted attributes:

1. **Authority pointers.** `@ref` / `@key` permitted on `<title>`,
   `<author>`, `<byline>`, and every NE element below.
2. **LJB tagging inventory** permitted in the body content model — inside
   `<p>`, `<l>`, `<head>`, `<lem>`, `<cb:t>`, `<note>`, `<seg>`, …:
   `persName`, `placeName`, `orgName`, `roleName`, `nobleTitle`, `title`,
   `date` (+ the Sanmiao `dyn`/`ruler`/`era`/`year`/`month`/`day` children
   from [ljb-tei-extensions.md](ljb-tei-extensions.md)).
3. **Interleaving.** The schema must let `<lb/>`, `<pb/>`, `<anchor/>`,
   `<g>` occur _inside_ those NE elements (TEI-ALL does). A name that spans
   a line boundary produces `<persName>阿<lb n="…"/>難</persName>` and that
   must validate.

The `_p5.rng` / `_p5.sch` the plugin bundles is CBETA's published schema
with those three loosenings applied — the same edit we already make to
TEI-ALL.

---

## 5. What does NOT carry cleanly into TEI-ALL

### 5.1 `<cb:tt>` / `<cb:t>` — bilingual parallel segments

CBETA's own docs: _"這是 CBETA 自訂標記，TEI 無此元素."_ Pairs (or
n-tuples) of the _same_ segment in different scripts/languages —
Siddhaṃ ⇄ Chinese, Chinese ⇄ Pali, translit ⇄ Chinese — shown as
facing lines or inline. 402 occurrences in T01n0001 alone.
`@type` = `app` (Pali from the apparatus column), `single-line`, `tr`,
`normal`; `@place="inline"`; `<cb:t>` can contain `<lg>`, `<cb:yin>`,
nested `<lb>`.

- **Not** `<choice>` (those are alternatives to pick one of; these are
  parallel and all kept). **Not** `<app>` (no editorial adoption).
- **CBETA-family:** keep `<cb:tt>`/`<cb:t>` verbatim (§4 schema admits them).
- **TEI-ALL export:** `<seg type="cb:tt">` wrapping `<seg type="cb:t"
xml:lang="…">` children; for `type="single-line"`/`tr` model on
  `<lg>`/`<l>` instead. `xml:lang` values (`sa-Sidd`, `sa-x-rj`,
  `san-tr`, `zh-x-yy`, `pi`, `x-unknown`) are valid BCP-47 private-use
  subtags — keep as-is.
- **Lossy:** the visual pairing semantics (`@rend="normal"`, margin
  styles) degrade to `@rend` hints. Acceptable.

### 5.2 `<cb:yin>` / `<cb:zi>` / `<cb:sg>` and `<cb:fan>` — phonetic gloss

_"TEI 無此元素."_ A head character (`cb:zi`) plus its reading (`cb:sg`):
tone (`去`, `引`), 反切 (`cb:sg type="fangie"` → `他以反`), or 二合 sandhi.
`<cb:fan>` is the same shape with the reading already inside a
`<note place="inline">`.

**Decided — downgrade to `<note>`, treat like `<note type="comm">`:**

- Unwrap `<cb:yin>` / `<cb:fan>`. The head characters (`<cb:zi>` content,
  e.g. 婆羅, 儒) **stay inline in the running text** — they are the text.
- Each `<cb:sg>` (or the `cb:fan` reading note) becomes a sibling
  `<note type="gloss">二合</note>` immediately after the head characters,
  with `subtype="fanqie"` when the source is `cb:sg type="fangie"`.
- Runs inside `<cb:t>` too (`cb:t` can contain `cb:yin`).
- Same transform in CBETA-family and cross-family imports — we don't keep
  `cb:yin`/`cb:sg` anywhere.
- **Round-trip:** `<note type="gloss">` + `@subtype` is enough to
  regenerate `<cb:yin><cb:zi>…</cb:zi><cb:sg>…</cb:sg></cb:yin>`; record
  the original wrapper (`yin` vs `fan`) in `@ana` if exactness matters.

### 5.3 `<cb:mulu>` — table-of-contents nodes

_"CBETA 自訂的目次節點 (TEI 無此元素)."_ Empty markers carrying the TOC
tree: `@type` ∈ {卷, 品, 分, 經, 序, 處, 會, 地, 論, 跋, 科判, 附文, 其他},
`@level`, `@n`, `@label`. **Two parallel hierarchies**: 卷 forms its own
system; everything else forms a second tree. `@n` sometimes disagrees with
the visible text. Empty `cb:mulu` (non-卷) means "don't show this node".

- TEI-ALL has no TOC-node element; it derives contents from `<div>`
  nesting + `<head>`, or an explicit `<front><div type="contents">`.
- **The two-hierarchy problem largely dissolves for us**: we split by
  juan, so 卷 becomes the _file boundary_ and the content-division tree
  becomes the in-file `<div>` structure. One tree per file.
- **At import:** consume `cb:mulu` to build the `<div type=…>` hierarchy
  and `<head>`s. Optionally emit a `<front><div type="contents">` per
  juan file.
- **For round-trip:** retain each original `cb:mulu` as
  `<milestone unit="mulu" type=… level=… n=… ana=…/>` (or in the standoff
  manifest) so the exact node set + labels + the "hidden node" cases can
  be reconstructed.

### 5.4 `<cb:juan>` / `<cb:jhead>` — volume head/tail blocks

`<cb:juan fun="open">` = 卷首 block (contains `<cb:mulu type="卷">` +
`<cb:jhead>` title line); `fun="close"` = 卷末 block. **Edge case:**
`<cb:juan>` can occur _inside_ `<note>` and _inside_ `<lem>` (a juan-end
recorded within apparatus — e.g. T04n0205, T16n0665). The splitter keys on
the top-level `fun="open"/"close"` pair and must not trip on the nested
ones.

- **At split:** `fun="open"` content → the new file's opening `<head
type="juan">` (from `cb:jhead`) + `<idno type="juan">n</idno>`;
  `fun="close"` content → trailing `<trailer>` or `<closer>`. Drop the
  `cb:juan` wrapper; keep `n` on the file + on a `<milestone
unit="juan">` at the head.
- Also handle: juan that **cross a source file** (GA0037, L1557 §51,
  X0714 §3) — the `fun="open"` and `fun="close"` land in different XML
  files. Full-work import concatenates the file set first (§5.7).

### 5.5 The apparatus-anchor residue in the body

Public P5 body carries, per collation point, a stack of empty anchors:
`<anchor xml:id="nkr_note_orig_…"/>`, `…_mod_…`, `…_add_…`, and
`<anchor xml:id="beg…"/>lemma<anchor xml:id="end…"/>`, plus star-collation
`beg_N`/`end_N`. The `<app>` / `<note type="orig"|"mod">` bodies live in
`<back><cb:div type="apparatus">`, linked by `@from`/`@to`. **T01n0001:
~12,600 anchors, ~13,000 `<lb>`, 3,215 `<app>` — roughly one anchor per
source line on top of one `<lb>` per line.**

- All of this **is already valid TEI-ALL** (`<anchor>`, `<app from/to>`,
  `<listWit>`). Nothing to convert.
- Problems are practical, not legal:
  - **Volume.** ~25k empty milestone elements per long text clutter the
    editor surface. Mitigation: collapse/hide anchors + `lb` in the
    tagging view; the importer emits a `data-…` or `@rend` marker the UI
    can key off.
  - **Auto-tagger.** Must build a plain-text projection (strip
    `anchor`/`lb`/`pb`/`g`→char), match on that, then re-insert NE tags
    around the milestones by offset. This is a matcher requirement, noted
    for the tagging pipeline, not a blocker.
  - **Overlap.** NE markup interleaves with `beg…/end…` spans. Fine,
    because both sides are empty milestones — `<persName>` is the only
    container and the anchors sit inside it harmlessly. No true
    tag-overlap.
  - **`@wit="#wit1 #wit2"`** depends on the header `<witness>` list —
    CBETA itself calls this streamed-ID scheme inconvenient. Keep the
    `<listWit>` in `<sourceDesc>`. Optional nicety: re-expand `#wit1` →
    `xml:id="Song"` etc. from the CBETA version-sigla table so apparatus
    is legible.
- **Recommendation:** keep body anchors and back-matter apparatus
  verbatim; do not fold apparatus inline (P5 deliberately undid that).

**On `xml:id` collision (open question, with a recommended answer).**
The imported file already contains thousands of `xml:id`s CBETA minted —
`nkr_note_orig_0001005`, `beg0001005`, `beg_1`, paragraph ids
(`pT01p0001a0501`), line-group ids (`lgT01p0548c0201`). The risk: when LJB
later adds its own elements (entity links, annotations, `<app>` anchors of
its own) and generates ids for them, it could mint one that already exists
in the imported text → a duplicate-`xml:id` validity error, or LJB tooling
that assumes it owns every id in the file.

Recommended approach — no pre-emptive renaming:

1. **Keep every CBETA `xml:id` verbatim.** The `@from`/`@to` apparatus and
   round-trip both depend on them.
2. **Reserve a prefix for LJB-minted ids** (e.g. `ljb-…`, or the project's
   existing scheme) so anything LJB generates is structurally incapable of
   colliding with a CBETA id.
3. **Guard at import.** The importer scans the incoming id set; on an
   actual clash with something LJB needs to mint, it renames the _LJB_
   side, or (last resort) the CBETA side with an entry in the round-trip
   rename map. Report any rename in the import log.

This extends the same XML-import path `import-planning.md` already
describes (demote `@key`→`@ana`, attach schema PIs, record provenance in
`revisionDesc/change`) with one added duplicate-id check.

### 5.6 `cb:`-namespace attributes on TEI elements

`cb:resp`, `cb:from`, `cb:to`, `cb:type`, `cb:place`, `cb:word-count`,
`cb:provider`, `cb:behaviour`, `cb:line`, `cb:id`. Mostly a mechanical
rename to the non-prefixed TEI attribute (`cb:resp`→`@resp`,
`cb:place`→`@place`, `cb:from/to`→`@from/@to`, `cb:type`→`@type`).
Drop-with-log: `cb:word-count`, `cb:provider` (→ `<note>` if wanted).
`cb:behaviour="no-norm"` (suppress 通用字 normalisation) → `@rend`/`@ana`
token or drop-with-log; low stakes.

### 5.7 One file = one work — except when it isn't

Normally 1 XML file per work. Exceptions from `work-multi-vol.md`:
`T0220` (大般若經, 25 files across T05–T07), `T0128a`/`T0128b` and
`T0150A`/`T0150B` (one Taishō number, two texts), `L1557` (4 files),
`P1612`/`P1615`, and ~30 two-file works. Some chapters cross volumes
(T0220 難信解品, T05→T06).

- **Full-work import** resolves the file set from the metadata
  (`work-id` → `[vol/file…]`), namespaces file 2..N's `xml:id`s
  (`prefix_ids`), concatenates `<body>` + `<back>` in catalogue order, splits
  by juan, then **stitches** any juan re-anchored across the file boundary —
  `stitch_cross_file_juan` merges adjacent slices sharing an `@n`. Unmarked
  continuation content is folded into the previous juan by the split itself.
- **Single-juan import** takes one juan from one file.
- The `0128a` / `0150A` case: treat each as a separate work (CBETA does).
  Lowercase suffix = CBETA-assigned, uppercase = Taishō-assigned —
  surface both in the picker.

### 5.8 `<byline>` — unparsed responsibility string

`<byline cb:type="Translator">後秦龜茲國三藏鳩摩羅什奉　詔譯</byline>` —
dynasty + region + monastic title + name + honorific + role verb, one
string. `cb:type` ∈ {Author, Translator, Editor, Collector, 較閱, other, …}.
Can appear inside `<item>`, `<p>`, `<lem>`.

- **Keep the string verbatim** in the text (it's on the page).
- **Populate `<titleStmt>/<respStmt>`** in each juan header from
  `cbeta-metadata/work-info` + DILA `Authority-Databases` (keyed by work
  id), `@role` from `cb:type`, `@ref`/`@key` to Norbert/DILA authority
  when the id is present — plain text otherwise. We already mirror DILA
  authority in `authority extraction/dila`.
- Do **not** parse the byline string itself at import — use the metadata
  join. (The API byline parser is a build-time check only.)

### 5.9 Characters

| Source                      | Meaning                                                             | TEI-ALL                                               |
| --------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `□` U+25A1                  | lacuna, character unknown to the editor                             | keep char, or `<gap reason="unknown"/>`               |
| `▆` U+2586                  | `<unclear>` rendered for a damaged/illegible spot                   | keep `<unclear>`; the ▆ is a rendering, not stored    |
| `<space quantity="0"/>`     | zero-width: base edition has nothing where another edition has text | keep as-is (lives in `<rdg>`/`<lem>`, rarely body)    |
| `<g ref="#SD-…">` / `#RJ-…` | Siddhaṃ / Rañjana, no Han Unicode                                   | keep `<g>` + bundled glyph image (`sd-gif`, `rj-gif`) |

CBETA's **Unicode-3.0 threshold** for `<g>` is a CBETA policy, not a
constraint on us: many `<g>` carry a real codepoint in `<charDecl>`.
Resolve `<g>`→char when `<charDecl>` gives one within our target Unicode
support; keep `<g>` for the rest. Copy the referenced `<char>`/`<glyph>`
subset into each juan file's header (or a shared sidecar).

---

## 6. Reference point: the DILA expert-tagged 續高僧傳

`buddhistinformatics.dila.edu.tw/biographies/gis/tang-gaoseng-zhuan.zip` —
T50n2060 re-tagged by DILA (Bingenheimer et al.) for the "Markup meets GIS"
prosopography project, from the CBETA CD 2008 baseline. 485 files, **one
per biography**, XInclude'd from `wrapper-tang.xml`; validates against a
bundled `gisSchema.rnc` (a standard TEI subset, _not_ CBETA's schema).

### What their experts kept

Element census across all 485 files:

| Kept                           | Count  | Form                                                                              |
| ------------------------------ | ------ | --------------------------------------------------------------------------------- |
| `<lb ed n>`                    | 23,746 | verbatim, every line, `ed="T"` + `n="0460a02"` (page·register·line)               |
| `<anchor n>`                   | 485    | **one per biography**, `n="T.50.2060.0460a02"` — the CBETA citation hook          |
| `<persName key>`               | 10,571 | `key="A005013"` → DILA person authority                                           |
| `<placeName key>`              | 6,787  | `key="PL000000021318"` → DILA place authority                                     |
| `<date … key>`                 | 2,085  | `from-iso`/`to-iso`/`when-iso`/`notBefore-iso`/`notAfter-iso` + `key` = JDN range |
| `<ptr target>`                 | 22,408 | footnote stubs (`fn01`) + entity refs inside `linkGrp`                            |
| `<linkGrp>` / `<link targets>` | 5,478  | GIS co-occurrence layer — project-specific, ignore                                |
| `<div>` `<head>` `<p>`         | —      | structure; div per biography                                                      |

### What they cut, completely

`<pb/>` · every `<note>` (all types, incl. apparatus) · `<app>` `<lem>`
`<rdg>` · all `nkr_note_*` / `beg*` / `end*` anchors · `<choice>` `<corr>`
`<sic>` `<reg>` · **all `cb:*`** (`cb:div`, `cb:mulu`, `cb:juan`,
`cb:jhead`, `cb:tt`, `cb:yin`, …) · `rend` / `style` · `<milestone>` · the
per-file `<teiHeader>` (one shared header in the wrapper). Apparatus was
reduced to bare `<ptr target="fnNN"/>` stubs.

### How we read this

- **It is the floor, not the template.** DILA's is the most aggressive
  defensible reduction for pure NE/GIS work. Nothing they kept is safe for
  us to cut. But their target (spatial-temporal network mining) doesn't
  need textual variants, gaiji fidelity, or commentary — **ours does** —
  so we deliberately keep more:
  - **gaiji** — resolve/retain per §5.9, not drop.
  - **commentary** (夾註 `<note place="inline">`) — kept inline, per §1.
  - **`<choice>`/`<corr>`/`<sic>`** — kept (maps cleanly, §3).
  - **apparatus** — kept in `<back>` as P5 ships it, hidden in the tagging
    view; not nuked.
- **Confirms our line-ref decision.** `<lb n="0460a02">` already carries
  **page + register + line**; `<pb>` is redundant for the number (DILA
  dropped it and lost nothing) — we keep `<pb>` only for the explicit page
  boundary + its `xml:id`. **Juan is _not_ in `<lb>`** — it comes from
  `<milestone unit="juan">` / `<cb:juan>`, so juan tracking stays a
  separate concern (and is our split key).
- **Their "one citation anchor per unit" is a good model** for a
  no-apparatus project: if a target project opts out of apparatus, emit
  one `<anchor n="T.50.2060.<first-line>">` per juan file instead of the
  per-collation anchors.
- **`@key` vs `@ref`.** DILA puts the bare authority id in `@key`
  (`A005013`, `PL0000…`). LJB's XML-import path currently _demotes_
  `@key` → `@ana` `ljb-former-key:…` for cross-family imports
  ([import-planning.md](import-planning.md)). For CBETA imports we want
  authority ids to land in a _live_ pointer — reconcile: either exempt the
  CBETA importer from the demotion and write `@ref="dila:A005013"` /
  `@key`, or define the project's authority-pointer attribute explicitly.
  (Open item — see §10.)
- **Biography chunking.** For the 高僧傳 family (and other biographical
  collections) the natural unit is the person, marked by
  `<cb:mulu type="其他">` / a biography `<head>` — feeds the "split by
  heading" mode; juan stays the default.
- **Caveat.** One genre. Tang biographies have no `<g>`, no `cb:tt`, no
  dhāraṇī, so this corpus says nothing about how experts handle those.
  §7 covers the long tail.

---

## 7. Construct inventory & disposition

Census over **27 files, ~110 MB**, genre- and canon-spread: Āgama
(T01n0001, T02n0099), Prajñā (T08n0235), Lotus (T09n0262), Huayan
(T10n0279), Mahāparinirvāṇa (T12n0374), Vimalakīrti (T14n0475), esoteric
(T18n0848, T19n0945, T20n1060), Madhyamaka (T25n1509), Abhidharma
(T29n1558), Vinaya (T22n1428), Yogācāra (T30n1579), Tiantai commentary
(T45n1858), Chan yulu (T47n1985, T48n2003), history/biography (T50n2059),
傳燈錄 (T51n2076), 音義 (T54n2128, T54n2131), Dunhuang (T85n2837), 卍續藏
(X78n1553, X80n1565), 嘉興藏 (J01nA042), 補編 (B10n0067), 藏外 (ZW01n0001).
Raw data: `scratchpad/inventory.txt`.

### Volume shape

| Construct                                 |          Count | Files | Disposition                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------- | -------------: | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<lb ed n>`                               |        477,913 | 27/27 | **keep** verbatim. Base `@ed` only (see X-canon row). Carries page·register·line.                                                                                                                                                                                                                                                     |
| `<anchor>`                                |        256,615 | 27/27 | **keep**; hide in tagging view. `@type` star 9,107 / circle 398; rest are `beg*`/`end*`/`nkr_note_*` apparatus hooks.                                                                                                                                                                                                                 |
| `<note>`                                  |        168,533 | 27/27 | see note-type table below — **the main ruling**                                                                                                                                                                                                                                                                                       |
| `<app>`/`<lem>`/`<rdg>`                   |     ~67,000 ea | 26/27 | **keep in `<back>`** as P5 ships. `@from`/`@to` 67,968.                                                                                                                                                                                                                                                                               |
| `<pb ed n xml:id>`                        |         15,706 | 27/27 | **keep** — redundant with `lb@n` for the number, kept for the page boundary + `xml:id`.                                                                                                                                                                                                                                               |
| `<cb:mulu>`                               |         14,730 | 27/27 | **consume** into `<div>`/`<head>` at import; retain as `<milestone unit="mulu" …>` for round-trip (§5.3). `@type` 其他 11,905 / 經 1,385 / 卷 750 / 品 331 / 序 41 / 分 13 / 附文 8.                                                                                                                                                  |
| `<space>`                                 |         14,548 | 25/27 | `<space quantity="0">` inside `rdg`/`lem` — **keep** (apparatus artefact).                                                                                                                                                                                                                                                            |
| `<cb:div>`                                |         13,904 | 27/27 | → `<div>` verbatim (§3). `@type` other 10,021 / jing 1,397 / mu 1,043 / xiang 561 / pin 273 / jie 187 / zhang 98 / xu 43 / di 29 / fen 13 / chu 8 / she 6 / shi 3 / tt 7 — **plus back-matter wrappers**: apparatus 26, add-notes 26, cbeta-notes 24, taisho-notes 22, rest-notes 14, xuzang-notes 2, zangwai-notes 1, equiv-notes 2. |
| `<g>` + `<charDecl>`                      |         29,939 | 26/27 | **resolve from `charDecl` / retain** (§5.9). `ref` prefix CB 29,905, SD 34, no RJ in sample.                                                                                                                                                                                                                                          |
| `<caesura>`                               |         27,564 | 21/27 | **keep** — verse cæsura.                                                                                                                                                                                                                                                                                                              |
| `<l>` / `<lg>`                            | 26,520 / 3,508 | 21/27 | **keep**.                                                                                                                                                                                                                                                                                                                             |
| `<cb:t>` / `<cb:tt>`                      |  3,388 / 1,691 |  7/27 | **every `cb:tt@type` in sample = `app`** (Pāli from the apparatus column) → these belong with the apparatus, not the body. Only non-`app` `cb:tt` (inline Siddhaṃ) is a body concern (§5.1).                                                                                                                                          |
| `<byline>`                                |          1,874 | 25/27 | **keep** string; fill respStmt from metadata (§5.8).                                                                                                                                                                                                                                                                                  |
| `<cb:juan>` / `<cb:jhead>`                |  1,499 / 1,701 | 27/27 | **consume at split** (§5.4). 751 open / 748 close.                                                                                                                                                                                                                                                                                    |
| `<milestone unit="juan">`                 |            751 | 27/27 | **the split key.** Only value is `juan`.                                                                                                                                                                                                                                                                                              |
| `<cb:yin>`/`<cb:zi>`/`<cb:sg>`/`<cb:fan>` |          38 ea |  3/27 | **downgrade to `<note type="gloss">`** (§5.2). Tiny; 音義-genre only. (Low count even in T54n2128 — that text likely encodes readings as plain text + `<note>`, not `cb:yin`; verify against a Huilin sample before finalising the transform.)                                                                                        |
| `<choice>`/`<corr>`/`<sic>`               |           9 ea |  2/27 | **keep** (maps cleanly, §3). Rare but wanted.                                                                                                                                                                                                                                                                                         |
| `<unclear>`                               |             45 |  5/27 | **keep**.                                                                                                                                                                                                                                                                                                                             |
| `<figure>`/`<graphic>`                    |             17 |  4/27 | **keep** `<graphic url>`; bundle/relocate the image asset.                                                                                                                                                                                                                                                                            |
| `<foreign xml:lang>`                      |          1,739 |  5/27 | **keep**. `xml:lang`: sa 2,320 / zh-Hant 1,800 / pi 1,113 / en 27 / x-unknown 2.                                                                                                                                                                                                                                                      |
| `<table>`/`<row>`/`<cell>`                |  1 / 204 / 728 |  1/27 | **keep**.                                                                                                                                                                                                                                                                                                                             |

### `<note>` — disposition by `@type` (decided 2026-08-31)

| `@type`            |  Count | Meaning                                      | Disposition                                                                                          |
| ------------------ | -----: | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `orig`             | 57,118 | Taishō's _original_ apparatus wording        | **not carried** into the working file — superseded by `mod`; recoverable from the pinned source (§8) |
| `mod`              | 53,431 | CBETA's _reworded_ version of the same point | **keep** in `<back>` with the `<app>`                                                                |
| _(none)_           | 45,766 | mostly `place="inline"` 夾註                 | **keep inline** (§1)                                                                                 |
| `add`              |  6,277 | CBETA editorial additions                    | keep (standoff)                                                                                      |
| `cf1`–`cf5`, `cf.` | ~4,900 | cross-references inside `lem`/`rdg`          | keep with the apparatus                                                                              |
| `equivalent`       |    944 | Pāli/Skt title parallels                     | keep (standoff)                                                                                      |
| `rest`             |     70 | apparatus that wouldn't convert to `<app>`   | keep (standoff)                                                                                      |

`@place`: `foot text` 57,116 · **`inline` 44,027** (the 夾註) · `foot` 1,493.

`orig` + `mod` (110k combined) are the _same_ collation point twice. The
tagging/reading copy keeps only `mod` — CBETA's adopted form, already
paired with the `<app>`. `orig` is left in the pinned source, not the
working file.

### Presentational (decided 2026-08-31)

- `@rend`: **454 total**, single value `no-marker` (on `<list>`). Keep.
- `@style`: 20,615, only `margin-left` (18,282) + `text-indent` (4,316) —
  pure indentation. **Dropped on import.**
- `lb@type="honorific"` — 30. The 擡頭/平出 honorific line-raise. Real but
  rare; keep the attribute.
- `anchor@type="circle"` 398 (◎), `anchor@type="star"` 9,107 (＊ ditto);
  `app@type` star 41 / star_removed 13. Keep — apparatus machinery, lands
  in `<back>`.

### X-canon triple line-numbering — the "`@ed` witnesses" case, live

`@ed` values across the sample: **T 400,745 · X 42,670 · R138 29,786 ·
R135 11,065 · B 7,696 · J 1,484 · ZW 173.** The two 卍續藏 files carry
`<lb>`/`<pb>` for **X (卍字藏 original) _and_ R135 + R138 (新文豐 reprint,
vols 135/138)** interleaved — so an X text really does have 2–3 parallel
line-numbering streams.

**Decided 2026-08-31:** keep the canon's own `@ed` stream (X, or
T/J/B/ZW); **drop the `R135`/`R138` reprint milestones** by default;
retain them only behind a per-project "新文豐 citability" flag.

---

## 8. Round-trip: what the mapping layer must guarantee (later phase)

The mapping is **data** (`data/mapping/cbeta-tei.json` or similar),
versioned with the plugin, applied by a fixed engine — same principle as
the import profiles in [import-planning.md](import-planning.md). To keep
CBETA → project → CBETA (and TEI-ALL ⇄ CBETA) reversible:

- Preserve original `xml:id`s (`nkr_note_*`, `beg*`/`end*`, `p`/`lg` ids);
  keep a rename map wherever we must change one.
- Keep `<back>` apparatus and `<listWit>` verbatim.
- **Do not down-convert** `cb:tt`/`cb:t`/`cb:mulu` etc. on a normal import
  — only on an explicit "export to strict TEI-ALL", and emit the reverse
  map alongside. (`cb:yin`/`cb:sg` are the exception: always downgraded to
  `<note type="gloss">` per §5.2, with `@subtype`/`@ana` carrying enough
  to regenerate the wrapper.)
- Record per juan file: source work id, juan `n`, source file path(s),
  CBETA data-version tag + git commit, importer version, mapping-table
  version — in `<revisionDesc><change>` (not `<sourceDesc>`, which holds
  `<biblStruct>`).
- Log per import: `<g>` resolved (with codepoints), `cb:mulu` consumed
  into `<div>`s, respStmt filled from metadata, any dropped `cb:*` attrs.
- A round-trip test corpus: one plain sūtra (T01n0001 juan 1), one with
  heavy `cb:tt` (T54n2133A), one 卍續藏 dual-line text (an X work), one
  multi-file work (a T0220 slice), one with nested `cb:juan` in `<lem>`
  (T04n0205).

---

## 9. Resolved (2026-08-31)

| Q                               | Answer                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Phonetic gloss mapping          | Downgrade to `<note type="gloss">` (§5.2), treated like `<note type="comm">`. Not `<pron>`.                                              |
| `<front>` TOC                   | Leave implicit in `<div>` nesting. No generated contents list.                                                                           |
| respStmt authority              | Resolve at import — bake the Norbert/DILA id into the header; plain text when absent; re-checkable later.                                |
| Schema packaging                | Treat CBETA P5 as a peer of TEI-ALL: bundle CBETA's published `.rng`/`.sch` with the three §4 loosenings applied. No separate generator. |
| `<note type="orig">`            | Not carried into the working file; keep `mod` + `add`/`cf*`/`equivalent`/`rest` in `<back>`. §7.                                         |
| `@style` indentation            | Dropped on import. §7.                                                                                                                   |
| `R135`/`R138` reprint line refs | Dropped by default; per-project 新文豐 flag to retain. §7.                                                                               |

## 10. Still open

1. **`xml:id` collision** — _resolved._ Two independent checks:
   - **CBETA-internal** (multi-file works): `juan_split.prefix_ids`
     namespaces file 2..N's `xml:id`s + pointers with the file stem before
     concat; each juan's `<back>` is pruned to its own anchors.
   - **LJB vs CBETA**: LJB's editor ids are `tinymce.DOM.uniqueId('dom_')`
     (`Writer.getUniqueId`), assigned to _every_ element on import and
     **stripped on save** — `cwrc2xml.ts` skips any `id` value starting
     `dom_`. CBETA's `xml:id` is not in `RESERVED_ATTRIBUTES`, so it rides
     through the `_attributes` blob and is re-emitted verbatim on export
     (pointers stay valid). No `ljb-` prefix reservation needed.
2. **`.sch` rules** — _resolved:_ CBETA's Schematron has only 3 rules, all
   requiring `@spanTo` on `addSpan`/`damageSpan`/`delSpan`; nothing touches
   inserted markup, so `loosen_schema.loosen_sch` passes it through.
3. **`cb:type` on `<sp>` / `<byline>`** — _resolved:_ kept verbatim in
   CBETA-family mode; renamed to `@ana` cross-family (`downgrade.structural`).
4. **`cb:yin` in a real 音義 text** — 11 MB of Huilin 一切經音義 (T54n2128)
   produced only 38 `cb:yin`, so that genre probably encodes readings as
   plain text + `<note>`, not `cb:yin`. Check one 音義 juan before
   finalising the §5.2 transform — the downgrade target may already be a
   `<note>` there.
