# Placename geo-disambiguation — Planning

*2026-07-24. Follows from discussion in [authority-databases-planning.md](authority-databases-planning.md) and the CHGIS pack work in `apps/desktop/src/authorityChgis.ts`.*

## Problem

Placename identity is worse-behaved than person identity. A person keeps a name (mostly) and a lifespan; a place keeps neither reliably:

- **Names move.** The same string (臨川) can denote a county seat, a river, or a temple depending on dynasty; conversely a single settlement carries different names across DILA, CBDB, and CHGIS because each project transliterates, periodizes, or splits administrative levels differently.
- **Referents move.** A prefecture's seat can relocate while keeping its name; a name can be reassigned to a new site after the old one is abandoned.
- **Authority string-matching is context-dependent.** Today's flow (`autoTagging/lookupResolve.ts`) links an external authority hit to a project entity by direct idno or by crosswalk (`crosswalkForRef` in [lookupResolve.ts](../packages/cwrc-leafwriter/src/autoTagging/lookupResolve.ts)). That works for persons, where an authority id is durable. For places, a name match found valid in one text (one period, one region) does not transfer to another occurrence of the same string elsewhere in the corpus — there is no per-context check today, so a wrong link silently propagates.

## Core idea

Add geography as a second, independent signal alongside the string match, and use it for **clustering candidates, not for authority linking per se**:

1. Every place authority already carries (or can be made to carry) coordinates — CBDB's `ADDR_CODES` has `x_coord`/`y_coord` and a `CHGIS_PT_ID`; DILA's place authority has `<location><place><geo>`; CHGIS is coordinates by definition (see the source notes in [authority-databases-planning.md](authority-databases-planning.md) §"Places — `ADDR_CODES`" and §"Place authority (TEI `<place>`...)").
2. When a name string turns up hits across multiple authorities/packs, compute pairwise great-circle distance between their coordinates.
3. A user-configurable **proximity radius** (km, in Settings) decides whether two hits are "close enough" to be considered the same physical place for linking purposes. Hits within the radius are grouped; hits outside it are treated as distinct candidates (this is exactly the "same name, different place" collision that string-only matching cannot resolve).
4. Grouped hits get **their time-period metadata merged for display**, not silently unioned into one fact: `DILA: 漢, 孫吳, 南齊, 唐; CBDB: 0–260, 501–504, 704–`. Each authority's own period string is kept verbatim and tagged by source; the merged line is a derived display, never a new stored fact, so contradictions/overlaps stay visible instead of being averaged away.

This turns "does this authority id apply here" into "is this authority's *point* within N km of that authority's *point*," which is a much better-conditioned question than string identity for a domain where places are only fuzzily equivalent to begin with.

## What this is / is not

- **Is:** an additional signal for the existing disambiguation and crosswalk-conflict UI (`viaCrosswalk.length > 1` path in `planLookupResolution`) — when a name string resolves to multiple project entities or multiple pack rows, geo proximity turns "N candidates, pick one" into "N candidates in M geographic clusters, pick a cluster (or a specific point within it)."
- **Is not:** a general place-identity oracle. Missing coordinates, a name with no authority hit, or a genuinely displaced-then-renamed site still need a human call. This is scoring, not solving.

## Design

### 1. Coordinate normalization

Add a shared `GeoPoint { lat: number; lon: number }` to the pack compile step (`authorityCompile.ts` family) so every place row in every NDJSON pack carries `metadata.geo?: GeoPoint` when the source has it. Sources without coordinates (e.g. a Markus-style flat CSV) simply omit it — treated as "no geo signal," never as "0,0."

### 2. Distance + clustering

- Haversine distance, pure function, no new dependency.
- Given a set of candidate rows (from `crosswalkForRef` / the entity-lookup dialog's candidate list) that share a matched name string, greedily cluster by mutual distance ≤ threshold (single-link clustering is enough at this scale — tens of candidates, not thousands).
- Threshold default: something on the order of 5 km, exposed in Settings as `placeProximityKm` (see [project-schema-planning.md](project-schema-planning.md) / wherever project prefs already live in `apps/desktop/src/projectPrefs.ts`). A single global number is the v1 scope — see Open questions for per-admin-level scaling.

### 3. Disambiguation UI change

In the entity-lookup dialog (`packages/cwrc-leafwriter/src/dialogs/entity-lookups/`) and the auto-tagging suggestion path (`autoTagging/suggestionFilters.ts`), when a place-type candidate set has ≥2 geo-bearing hits:

- Hits inside one cluster render together with the merged period line.
- Hits in a different cluster (i.e. genuinely distant despite the name match) render as a visibly separate group — this is the "these are two different places" case surfacing automatically instead of silently picking the first hit.
- Rows with no coordinates fall back to today's plain string/crosswalk behavior and are labeled "no geo data" rather than folded into either cluster.

### 4. Merge-time period display

- Keep each source's period string (dynasty label for DILA, year range for CBDB, etc.) attached to its own idno, never rewritten.
- Derive a single display line by source, in a stable source order, joined with `;` — the format in the prompt (`DILA: 漢,孫吳,南齊,唐; CBDB: 0-260, 501-504, 704-`). This is purely presentational (entity panel, hover card, mint-time description field); the underlying `idnos` array and any per-authority metadata are untouched.
- When linking (not minting), this merged line can seed the entity's `description` note the way `candidateMeta.description` does today in `planLookupResolution` — but only if the entity has no description yet, matching the existing non-destructive enrichment behavior (`splitEnrichment`).

## Phasing

- **Phase 1 — Coordinates in packs.** Extend CBDB/DILA/CHGIS pack compilation to carry `metadata.geo`. Acceptance: a compiled pack's place rows for a known ambiguous name (e.g. 臨川) show two distinct coordinate pairs when they are, in fact, two different places.
- **Phase 2 — Distance + clustering utility.** Pure `packages/cwrc-leafwriter/src/autoTagging/geoCluster.ts`: haversine + greedy clustering, unit-testable without any UI. Acceptance: synthetic fixture with 3 authorities × 2 real clusters resolves correctly at a given threshold.
- **Phase 3 — Settings + wiring into crosswalk conflict path.** `placeProximityKm` in project prefs; `planLookupResolution`'s `conflict` branch (and the auto-tagging suggestion filter) groups candidates by cluster before presenting them.
- **Phase 4 — Merged period display.** Source-tagged period strings surfaced in the disambiguation UI and used as fallback description text on mint/link.
- **Deferred:** per-admin-level (or per-place-type) adaptive radius instead of one global number; historical relocation modeling (a place whose *point* itself changes over time, which geo-clustering alone can't distinguish from "renamed and never moved").

## Open questions

1. **Fixed global radius vs. scaled-by-type.** A temple and a circuit/province need very different "close enough" radii. V1 ships one global setting; do we want an early override per DILA/CBDB admin-type bucket, or wait until the flat radius proves wrong in practice?
2. **Confidence score vs. hard cutoff.** A hard km cutoff creates edge-of-threshold artifacts (4.9 km groups, 5.1 km doesn't). A distance-decay confidence score is more principled but adds UI complexity (how do you show "80% confident same place"?) — probably not worth it for v1.
3. **Missing-coordinate fallback rate.** Need to check what fraction of DILA/CBDB place rows actually carry coordinates before promising this covers "most" ambiguous cases — some rows may only have a district-chain reference and no lat/lon at all.
4. **Does a cluster ever get its own idno-like identity** (a synthetic "this is the same physical spot" id), or does it stay purely a UI grouping recomputed each time? Recomputing is simpler and avoids yet another id space; lean that way unless projects need to store "we decided these are the same place" durably.
