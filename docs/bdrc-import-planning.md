# BDRC import — planning

**Status (2026-08-31):** Design. No code yet. Sibling of
[cbeta-import-planning.md](cbeta-import-planning.md),
[kanripo-import-plugin-planning.md](kanripo-import-plugin-planning.md),
[corpus-extraction-planning.md](corpus-extraction-planning.md),
[wikisource-import.md](wikisource-import.md). Explored alongside CBETA, but the
two plugins share only the TEI emitter and the resolve-authority-later stance —
see §1. Ship: after CBETA's first importer, gated on reading the
[Feb 2026 BDRC open-dataset announcement](https://www.bdrc.io/blog/2026/02/28/bdrc-launches-major-initiative-to-build-open-buddhist-datasets-for-ai/)
(post knowledge-cutoff here; it may change what is available in bulk).

---

## 1. Why this is not the CBETA plugin

|             | CBETA plugin                                                                      | **BDRC plugin**                                                                                                           |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Corpus      | `DILA-edu/cbeta-xml-p5` git tree, bundled under `data/`, **no network at import** | No bundleable tree. **Live fetch from the PDI at import time**                                                            |
| Delivery    | work id / juan URL in the LJB dialog                                              | **Browser extension** on the BUDA reader, native messaging → LJB, same path as [Wikisource/Kanripo](wikisource-import.md) |
| Unit        | one juan, or full work                                                            | **one `UT` etext volume**, `<pb/>` markers throughout; the page the user was reading is only the entry point              |
| Language    | Literary Chinese (Buddhist)                                                       | Tibetan (`bo`), pecha folio pagination                                                                                    |
| Schema work | translate rich CBETA P5 markup down to TEI-ALL (§5 of that doc)                   | almost no source markup — the work is **building** `<div>`/`<pb>` structure, not translating it                           |
| Round-trip  | TEI-ALL ⇄ CBETA ⇄ Kanripo ambition (later phase)                                  | **one-way only.** No "export to BDRC". Provenance is for re-fetch and citation                                            |

Shared: the `ExtractedDocument` → TEI emitter from
[corpus-extraction-planning.md](corpus-extraction-planning.md), and
`@ref`-to-authority-URI-now / resolve-names-later (§6).

**Departure from Kanripo discipline, on purpose.** The other import plugins
forbid network at import. BDRC has no static per-resource tree we found under
the `buda-base` GitHub org (that org is server code, ontology, and tooling —
`lds-pdi`, `lds-queries`, `owl-schema`, `git-to-dbs`; the editor's git backend
repos are not public), and the full etext corpus is large and partly
access-restricted. So the plugin fetches from
[`purl.bdrc.io`](http://purl.bdrc.io/index) at import. Mitigation: a local
on-disk cache keyed by `UT` id + revision (§7), so a re-import is offline.

---

## 2. Source: the BDRC Public Data Interface (LDS-PDI)

`http://purl.bdrc.io` — a linked-data server. What the plugin uses:

1. **Per-resource resolution.** `purl.bdrc.io/resource/{ID}` with content
   negotiation → Turtle / JSON-LD / N-Triples. IDs are typed by prefix:
   `WA` abstract work, `MW` instance (metadata), `W` instance, `I` image
   group / volume, `UT` **etext**, `P` person, `G` place, `T` topic,
   `O` outline node, `L` lineage, `C` corporation.
2. **Named-query API.** `purl.bdrc.io/query/{graph|table}/{QueryName}?PARAM=bdr:…`
   — a published catalog (`buda-base/lds-queries`), **not** open SPARQL.
   `format=ttl|jsonld|json`, `pageSize`/`pageNumber` for tabular. Confirmed
   query names in §2.2.
3. **IIIF.** `iiif.bdrc.io` — Presentation manifests per volume, Image API per
   folio. Gated by the item's access status.
4. **OAI-PMH** metadata feed — not needed for import; possible future use for
   a "what's new" panel.

No API key today; be a good citizen (rate-limit, cache, `User-Agent`
identifying LJB). Confirm current terms before ship.

### 2.1 The etext model

A `UT…` resource is a transcription (manual or OCR) of one **volume**, scoped
to an image group (`UT<instance>_I<imagegroup>_NNNN`). Its content is a set of
**chunks** and a parallel set of **pages**, both expressed as slices over one
character axis:

- **chunk** (`bdr:EC…`): `bdo:chunkContents` (the text literal, `\n` line
  breaks), `bdo:sliceStartChar` / `bdo:sliceEndChar`.
- **page** (`bdr:EP…`): `bdo:seqNum` (scan image index — **not** a folio
  label), `bdo:sliceStartChar` / `bdo:sliceEndChar`, `tmp:inInstancePart`.
- etext → `tmp:inImageGroup bdr:I…`, `tmp:inInstance bdr:MW…`.

Reconstruction: concatenate `chunkContents` in `sliceStartChar` order → one
character string; each **page** `sliceStartChar` is a `<pb/>` boundary;
`\n` inside the text is `<lb/>`.

### 2.2 Confirmed PDI shape (2026-08-31, against `purl.bdrc.io`)

| Need                                 | Call                                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Etext info + access                  | `/query/graph/Etext_base?R_RES=bdr:<UT>&format=nt`                        | `adm:access` (`bda:AccessOpen`/`AccessFairUse`/…) on the admin subject, `adm:status bda:StatusReleased`, `bdo:etextIsPaginated`, `bdo:hasPages`. Instance chain: `<UT> bdo:eTextInInstance <IE…>`; `<IE> bdo:instanceOf <WA…>` (abstract work); `<IE> bdo:instanceReproductionOf <W…>`, `<MW…>` (scanned instance — prefer the `MW`). Volume title = the `<UT>` `skos:prefLabel` (Tibetan, `@bo`). **No** image-group and **no** transcription-method predicate here — §9.4/§9.5.                                                                                                                  |
| Text + page slices                   | `/query/graph/chunkContext?R_UT=bdr:<UT>&I_START=<n>&I_END=<n>&format=nt` | Params `R_UT`, `I_START`, `I_END`. Returns `EC` chunks (`bdo:chunkContents` — leading U+FEFF BOM on folio 1) + `EP` pages, plus `<UT> bdo:inImageGroup <I…>`. Windowed: advance `I_START` to the max `sliceEndChar` seen until a window adds nothing. Access filter baked in — restricted content returns zero triples.                                                                                                                                                                                                                                                                            |
| Edition / publication metadata       | `/resource/<MW-or-W>.nt`                                                  | Content-negotiated describe graph of the scanned instance. Best-effort, matched by predicate **local name**: `editionStatement` (literal, often `@bo`) → `<edition>`; `publisherName` / `publisherLocation` → `<publisher>` / `<pubPlace>`; a `PublishedEvent` node (blank, via `instanceEvent`) with `onYear` (`xsd:gYear`) or `notBefore`/`notAfter` → `<date>`. Only a clean 4-digit year is emitted as `@when`/`@notBefore`/`@notAfter`; a fuzzy label is dropped. Exact predicate URIs still to be re-verified against a live record — a miss yields no `<edition>`/`<date>`, never an error. |
| Image list (folio labels, filenames) | `/query/table/Instance_ImgList?R_RES=bdr:<MW>`                            | Returns `?grId` (legacy image-group RID) + `?list` — an aggregated image-list blob (historically JSON: `filename`, dimensions, indexed by position ≈ `seqNum`). Parse for folio labels + IIIF filenames.                                                                                                                                                                                                                                                                                                                                                                                           |
| Verify against a reference           | `/queries/<name>`                                                         | Live template metadata (`#QueryParams`, `#param.*.type`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

`bdo:` = `http://purl.bdrc.io/ontology/core/`, `bda:` = `.../admindata/`,
`adm:` = `.../ontology/admin/`, `tmp:` = query-scoped temp predicates.

Worked example (smoke-tested end to end): `bdr:UT4CZ5369_I1KG9127_0000` —
Vinaya vol. ka of the Derge Kangyur, `IE4CZ5369` → work `WA0BC001`, scan
instance `MW4CZ5369`, image group `I1KG9127`, `AccessOpen`, 81 folios
(`seqNum` starts at 3 — the first images are cover boards). Emits
`<p><pb n="3"/>༄༅། །འདུལ་བ་ཀ…<pb n="4"/>…<lb/>…</p>`.

---

## 3. Decisions already taken

| #             | Decision                                                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delivery      | Browser extension (Brave/Chromium), native messaging → LJB **Import from BDRC…**, mirroring [wikisource-import.md](wikisource-import.md). The extension reads the BUDA reader URL and resolves the `UT`/`W`+volume id; **it does not scrape page text** (same as the Kanripo path).                                                                |
| Trigger       | The BUDA reader URL the user is on → resolve to one `UT` etext + its `W`/`MW` instance and `I` volume. A work-level URL with no volume selected → volume picker in the dialog.                                                                                                                                                                     |
| Import unit   | **One `UT` etext volume per import.** "Less clicking" — a real transcription job pulls the whole volume, not folio by folio.                                                                                                                                                                                                                       |
| Fetch         | Live from the PDI at import. Not bundled. Local cache for re-import (§7).                                                                                                                                                                                                                                                                          |
| Text          | Tibetan Unicode (U+0F00–U+0FFF), NFC at emit. Whitespace policy `ignore` for `bo` per [Auto-tagging.md](Auto-tagging.md).                                                                                                                                                                                                                          |
| Structure     | Chunk→page links → `<pb n="…" facs="…"/>`; transcription line breaks → `<lb/>`. **No automatic `<p>` insertion** — Tibetan has no blank-line paragraphing; body is `<ab>`/`<p>` spanning the volume with milestones, or `<div>` per outline node when §4.2 applies.                                                                                |
| Facsimile     | `<pb @facs>` points at the IIIF Image API URL for that folio **when the volume's access tier permits**; omitted with a `<note type="extraction">` otherwise.                                                                                                                                                                                       |
| Metadata      | Walk `UT → I → W/MW → WA`: title(s), volume label, folio range, `adm:access` tier, license / attribution string → `<sourceDesc>` + `<idno type="URI">` / `<idno type="BDRC">`.                                                                                                                                                                     |
| Authority     | Persons `bdr:P…`, places `bdr:G…`, roles `bdr:R…` emitted as `@ref="http://purl.bdrc.io/resource/…"`; **names not resolved at import.** A later pass uses the Wikidata crosswalk (P2477, 23,266 `bdrc` pairs in the 2026-08 authority extract). No bundled BDRC person/place pack. See [authority-data-lifecycle.md](authority-data-lifecycle.md). |
| Names         | Keep the Tibetan (Uchen) form as the element content / `<persName>`; carry Wylie (`bo-x-ewts`) and phonetic forms as `<persName type="alt">` when present.                                                                                                                                                                                         |
| Output path   | `imported/bdrc/<W-or-MW-id>/<UT-id>.xml` — one file per etext volume.                                                                                                                                                                                                                                                                              |
| Target schema | TEI-ALL (or the open project's family). No BDRC-specific schema — there is almost nothing to preserve. LJB tagging inventory (`persName`, `placeName`, … + Sanmiao `date`) admitted in the body content model exactly as for other imports ([ljb-tei-extensions.md](ljb-tei-extensions.md)).                                                       |
| Access        | `AccessRestrictedByTbrc` / restricted-in-region → the dialog shows a clear error and links the BUDA reader; **never** a silent partial import. Open-metadata + restricted-content is a valid state: import the metadata-only stub with a `<note type="extraction">` explaining the gap.                                                            |
| Round-trip    | Out of scope. Record enough provenance (§8) to re-fetch and cite; no reverse mapping.                                                                                                                                                                                                                                                              |

---

## 4. TEI emission

### 4.1 Skeleton

Reuse `buildSkeletonForCatalog()` ([import-planning.md](import-planning.md)).
Header filled from the PDI walk:

- `<titleStmt><title>` — the `MW`/`WA` primary title (Tibetan), `<title type="alt">` for Wylie / other-language titles.
- `<titleStmt><respStmt>` — one per `WA`/`MW` creator blank node: `<name @ref="…P…">`, `<resp>` from the `bdr:R…` role label (author, translator, scribe, reviser, …). Plain `<name>` when no person id.
- `<publicationStmt>` — BDRC as distributor; the required attribution string verbatim; `adm:access` tier surfaced as `<availability status="…">`.
- `<sourceDesc><bibl>` — instance (`W`/`MW`) title; `<edition>` + `<pubPlace>`/`<publisher>`/`<date>` from the instance describe graph when it carries them (§2.2 row 3; `<date>` only with a clean 4-digit year); `<idno type="URI">http://purl.bdrc.io/resource/<UT></idno>`, plus `<idno type="BDRC">` for `W`, `MW`, `I`; and a `<note type="source">` naming BDRC and linking the reader URL the import was launched from (falling back to the resource purl).
- `<notesStmt>` / `<encodingDesc>` — transcription method (`OCR` vs manual) from the `UT` admin data; note it downstream so an OCR volume can be flagged for review.

### 4.2 Body

- **Default:** one container (`<p>`/`<ab>`) for the volume, `<pb/>` + `<lb/>`
  milestones throughout. Folio numbers from the image list's pagination
  values — pecha recto/verso style: `<pb n="1a"/>`, `<pb n="1b"/>`, …;
  Western numbering kept as-is where a modern book.
- **Outline-driven `<div>` (when available):** if the instance has an `O…`
  outline whose nodes carry etext offsets, cut `<div type="…">` + `<head>` at
  those offsets — the BDRC analogue of CBETA `cb:mulu` (but far rarer for
  etexts). When absent, leave structure flat; do not synthesise divisions
  from punctuation.
- **Tibetan punctuation** (tsheg `་`, shad `།`, `༎`) is content — kept
  verbatim, never converted to `<pc>` or used to split blocks.
- **Editorial brackets** in the transcription (`[…]` illegible, supplied
  text, OCR uncertainty markers) — low volume; v1 keeps them as literal
  text, a later pass can map to `<unclear>` / `<supplied>`. Recorded as an
  open item, not a blocker.

### 4.3 Characters

Tibetan is fully in Unicode; the CBETA gaiji problem does not recur. Residue:
Sanskrit in Tibetan script (Lantsa/Rañjana) and rare non-encoded glyphs —
keep the codepoints the transcription used; `<g>` only if BDRC itself ships a
non-Unicode marker (uncommon in etext). NFC on emit.

---

## 5. Extension flow

Mirrors [wikisource-import.md](wikisource-import.md) "Browser extension" +
"Kanripo via the same extension":

1. LJB run once writes the native-messaging manifest
   (`org.lejeanbaptiste.import.json`). `ljb-browser-host` on `PATH`.
2. On a BUDA reader page (`library.bdrc.io/show/bdr:…` — exact URL / hash /
   query patterns for the etext reader to be confirmed, §9), the extension
   resolves the `UT` id (and `W`/`MW`, volume) from the URL. It does **not**
   read page text.
3. Click **Import** → LJB opens **Import from BDRC** with the volume
   pre-selected. Work-level URL → volume picker.
4. Confirm → LJB fetches the etext graph + metadata from the PDI, emits the
   file, runs the validator, writes `imported/bdrc/<W|MW>/<UT>.xml`.
5. If LJB is not running, the popup says so (same as the other adapters).
   Reader pages that are not a text (person, place, outline, search) are
   rejected in the popup.

Extension id to be pinned like the Wikisource one.

---

## 6. Authority — resolve later, not at import

Consistent with [cbeta-import-planning.md](cbeta-import-planning.md) §5.8 and
[authority-data-lifecycle.md](authority-data-lifecycle.md):

- At import, every `bdr:P…` / `bdr:G…` from the metadata becomes an `@ref` to
  the purl. No name lookup, no pack join.
- A later authority pass resolves `@ref` → Norbert/Wikidata via the P2477
  crosswalk already compiled in `authority extraction/` (2026-08 extract:
  23,266 `bdrc` pairs). Unmatched ids stay as bare purls — re-checkable.
- Place ids feed the same pipeline as
  [placename-geo-disambiguation-planning.md](placename-geo-disambiguation-planning.md);
  BDRC `G…` places carry coordinates in the graph, usable as a disambiguation
  hint, but that is the geo pass's concern, not the importer's.
- **Not planned:** a bundled BDRC authority pack. If the Feb 2026 open-dataset
  release includes a redistributable person/place dump, revisit — it would
  let the resolve pass run offline.

---

## 7. Caching

- On first fetch, store the raw `UT` etext graph + the `W`/`MW`/`I` metadata
  graphs under the plugin's cache dir, keyed by `UT` id + BDRC revision
  (`adm:` gitRevision / dateModified).
- Re-import of the same volume, or import of a second volume from a
  work already partly fetched, reads the cache — offline.
- `Refresh` in the dialog forces a re-fetch and updates the cache.
- The cache is a convenience, never a corpus: no bundling in the release
  archive, `.gitignore`d, safe to delete.

---

## 8. Provenance recorded per file

In `<revisionDesc><change>` (not `<sourceDesc>`):

- `UT` id, `W`/`MW` id, `I` volume id, folio range imported.
- BDRC data revision (graph `adm:` revision + fetch timestamp).
- PDI query name(s) used, importer version.
- Transcription method (OCR / manual) and, for OCR, a review-needed flag.

Per-import log: chunks fetched, `<pb/>` count, respStmt entries filled,
`@facs` links emitted vs suppressed (access), any editorial brackets left as
literal text.

---

## 9. Open questions (👤 decide / confirm)

1. **Folio labels** — pages carry only `bdo:seqNum` (scan index, starts at 3 —
   the first images are cover boards). Real pecha folio labels (`1a`, `1b`, …)
   would come from `Instance_ImgList`, but that query returned zero rows for
   `bdr:MW…` / `bdr:W…` / `bdr:I…` params (2026-08-31) — needs the right
   resource id or the images-git `dimensions.json`. **v1 ships
   `<pb n="{seqNum}"/>`**; folio labels are a later polish.
2. **Volume vs. instance granularity** — a `W`/`MW` with many `UT` volumes:
   one import = one volume (current decision). Offer "import all volumes of
   this work" as a batch, or leave that to repeated clicks?
3. **Editorial brackets** (§4.2) — worth a v1 mapping to `<unclear>` /
   `<supplied>`, or defer entirely to the tagging pipeline?
4. **OpenPecha overlap** — many BDRC texts have an OpenPecha counterpart with
   richer standoff (segmentation, pedurma variants). Out of scope here
   ([corpus-extraction-planning.md](corpus-extraction-planning.md) lists it as
   a separate P2 adapter), but note the `bdr:` id is the join key when both
   land in a project.

### Resolved by investigation (2026-08-31)

- **Feb-2026 open-dataset release** — [the announcement](https://www.bdrc.io/blog/2026/02/28/bdrc-launches-major-initiative-to-build-open-buddhist-datasets-for-ai/)
  is a roadmap running **through summer 2027** (HuggingFace, public domain).
  Nothing bulk is downloadable now, so "live PDI fetch, no bundle" (§1, §3)
  stands; revisit when the HF datasets land.
- **BUDA reader URL** — `/show/bdr:<IE>?scope=bdr:<IE>&openEtext=bdr:<VE>&startChar=<n>&back=bdr:<MW>`.
  The reader names the volume as `VE<n>_I<ig>`; the retrievable transcription
  is `UT<n>_I<ig>_0000` (`EtextPaginated`, has content + `contentsGitRevision`).
  `VE…volumeHasEtext…` targets are empty structural nodes — ignored. The
  extension grabs `openEtext`; `bdrcRef.mjs` maps `VE → UT…_0000`.
- **IIIF `@facs`** — confirmed `https://iiif.bdrc.io/bdr:<I>::<I><seqNum:04d>.jpg/full/max/0/default.jpg`
  (`info.json` on that identifier returns IIIF Image API 2). Built directly
  from image group + `seqNum`; an `Instance_ImgList` filename would override
  for non-`<RID><NNNN>.jpg` scans.
- **Transcription method (OCR vs manual)** — **no predicate** on
  `/admindata/<UT>` (only `contentsGitRevision`, `gitRepo`, `gitPath`,
  `status`) or `/admindata/<IE>` (`access`, `syncAgent`, `status`,
  `metadataLegal`). Ships `method: "unknown"`, no review flag.
- **Cache key** — `contentsGitRevision` from `/admindata/<UT>`. A volume
  serves from `<userData>/bdrc-cache/<UT>__<revision>.json` until BDRC
  re-syncs it or the user ticks "re-fetch". No revision ⇒ never cached.

---

## 10. Resolved (2026-08-31)

| Q                | Answer                                                                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delivery         | Browser extension, not a paste-URL dialog as the primary path.                                                                                                                                                                                                                                 |
| Import unit      | Whole `UT` volume with `<pb/>` markers, not folio-at-a-time.                                                                                                                                                                                                                                   |
| Bundle vs. fetch | Live PDI fetch + local cache. No bundled corpus (nothing bundleable found).                                                                                                                                                                                                                    |
| Authority        | `@ref` to purl at import; Wikidata P2477 crosswalk resolves later; no bundled pack.                                                                                                                                                                                                            |
| Round-trip       | Out of scope — one-way, provenance only.                                                                                                                                                                                                                                                       |
| Target schema    | TEI-ALL / project family. No BDRC schema.                                                                                                                                                                                                                                                      |
| PDI retrieval    | Confirmed live (§2.2): `Etext_base` for info/access, `chunkContext` (`R_UT`/`I_START`/`I_END`) for windowed text + page slices, `/admindata/<UT>` for the revision. Predicates `bdo:chunkContents`, `bdo:sliceStartChar/EndChar`, `bdo:eTextHasPage`, `bdo:seqNum`, `adm:contentsGitRevision`. |
| Reader URL → id  | `openEtext=bdr:VE<n>_I<ig>` → `UT<n>_I<ig>_0000`. Browser extension captures `openEtext`; `bdrcRef.mjs` maps it.                                                                                                                                                                               |
| `@facs`          | `https://iiif.bdrc.io/bdr:<I>::<I><seqNum:04d>.jpg/full/max/0/default.jpg`, built from image group + seqNum.                                                                                                                                                                                   |
| Cache            | `<userData>/bdrc-cache/<UT>__<contentsGitRevision>.json`; "re-fetch" toggle in the dialog clears it.                                                                                                                                                                                           |
