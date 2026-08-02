# Date-chunked authority packs

**Status (2026-08-02):** Runtime reader and pack contract in progress. The
existing one-file NDJSON layout remains supported until regenerated packs ship.

## Purpose

Large NDJSON authority packs are expensive because the renderer must read,
transfer, parse, and retain every row before the tag bomb can discard rows
outside its date filter. This format makes the date filter a loading boundary,
not merely a later matcher filter. It applies to large compiled tag packs;
CBDB and Norbert SQLite reference databases remain whole, indexed query
databases and are not partitioned.

## Layout

Small packs keep their existing `persons.ndjson`/`places.ndjson` file. A pack
that crosses the compiler threshold (initially 10 MB or 50,000 entities) may
replace it with a sibling directory and a manifest entry:

```text
cbdb/
  persons/
    -0399--0200.ndjson
    -0199-0000.ndjson
    0001-0200.ndjson
    undated.ndjson
  manifest.json
```

The manifest records format version, block size (initially 200 years), every
chunk's inclusive interval and relative path, its entity/string counts, and
the undated chunk. It also records whether undated rows should be retained for
a restrictive `limit` filter (for sources such as timeless place records).

## Selection policy

- No date filter: read every chunk.
- `limit`: select every chunk intersecting the requested interval, plus two
  neighbouring blocks before and after; then apply the ordinary record-level
  date filter.
- `exclude`: retain the legacy full-pack path for now. It is correct for
  undated records and avoids accidentally treating a partial chunk list as a
  complete exclusion result.
- The reader deduplicates repeated boundary rows before crossing IPC.

The guard band is a safety margin, not the correctness guarantee. A dated
record is emitted into every block its effective interval overlaps. Long-lived
or coarse records therefore remain available even at a boundary. Invalid,
zero-sentinel, implausible, or over-400-year intervals are deliberately
classified as undated rather than replicated through every historical block.
Undated records go to `undated.ndjson` and follow the manifest's explicit
policy.

## Disambiguation

Pack-backed lookup uses the same reader when it receives a range. SQLite
reference lookups keep querying their intact CBDB/Norbert databases. A
date-filtered exact-name lookup must fall back to an unfiltered exact-name
search when the restricted query finds no candidate; date filtering ranks or
narrows candidates, never proves that a same-name record does not exist.

## Compiler invariants

The compiler must fail the build when any check fails:

1. Every input entity is emitted to at least one dated chunk or the undated
   chunk.
2. The emitted input-row count equals the source count, and the distinct
   `(source, authorityId)` count in output equals the input distinct-ID count.
3. Every original matchable search string occurs in at least one output row.
4. Every emitted NDJSON line parses and has the original candidate identity.
5. Duplicate physical rows are only expected boundary overlap; manifest totals
   distinguish physical rows from distinct entities.

Boundary duplication may increase bytes and line counts. It must never reduce
the distinct entity or search-string totals.

## Compatibility and rollout

The desktop reader detects the manifest entry. When it is absent, it reads the
legacy single file exactly as today. We will first regenerate and profile CBDB
persons, then apply the same compiler helper to any pack above the threshold.
