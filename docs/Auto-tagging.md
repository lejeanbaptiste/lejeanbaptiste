# Auto-tagging

## Architecture: the suggestion object

Every auto-tagging method — dictionary, dates, AI, NER, and later disambiguation — emits the same intermediate object rather than touching the XML itself. All the shared machinery (review UI, apply, undo, conflict resolution, logging) is built once against this object.

A suggestion looks roughly like:

```json
{
  "id": "sug_0042",
  "source": "dictionary | dates | ai | ner | disambiguation",
  "sourceDetail": "e.g. dictionary table name, model id, ruleset version",
  "action": "add | remove | retag | redraw-boundary | assign-entity",
  "tag": "persName",
  "attributes": { "key": "p0123" },
  "anchor": {
    "documentId": "...",
    "xpath": "/TEI/text/body/div[2]/p[3]/text()[1]",
    "offset": 47,
    "surface": "張衡",
    "occurrence": 2,
    "contextBefore": "太史令",
    "contextAfter": "造候風地動儀",
    "nodeHash": "..."
  },
  "confidence": 0.95,
  "rationale": "Nearby text discusses calendrical instruments.",
  "status": "pending | accepted | rejected | unresolvable"
}
```

Key points:

- **Anchoring** follows the W3C Web Annotation selector model in spirit: verbatim surface string + occurrence/context is the primary locator, XPath + offset is the fast path, and the hash detects staleness. If the string isn't found where claimed, the suggestion is dropped or flagged as unresolvable — never mis-applied. Within a single session we can instead insert temporary ids on affected nodes and flush them when the session ends; the fuzzy re-anchoring machinery is only needed across sessions and is deferred.
- **Apply is one engine.** It performs insert-into-text-node, dedup, and schema-rule checks (checking whether the target context allows the tag *before* insertion, not just repairing after), then validates.
- **One undo step.** Applying a batch of suggestions is a single undoable operation, and nothing is applied until it passes through the review gate.
- **Review is one UI.** The split-screen audit walk (editor on one side, to-do list on the other, keyboard-navigable like find-and-replace, with per-item rationale and ok/reject/correct) is the commit gate for *all* methods, not just AI audit. "Dumb" methods just produce suggestions with `rationale` like "matched dictionary entry X".
- Accepted/rejected decisions are appended to the **decision log** (see Disambiguation), which feeds both future defaults and AI context.

### Phase 0 specifications (decided)

**Normalization is central and happens once.** On document load (before any anchor is created or verified), text nodes are NFC-normalized at a single central point. Producers and the verifier never normalize independently — they assume NFC. This keeps offsets and occurrence counts consistent between the process that created an anchor and the one resolving it.

**Whitespace policy.** Matching operates on a *search text* derived from text nodes, with an offset map back to raw positions so insertion happens at the correct raw offset. Two policies, a project setting defaulted from the document language: `ignore` (whitespace stripped — CJK documents, where in-node whitespace is layout noise and may fall mid-name) and `collapse` (runs collapsed to a single space — whitespace-delimited languages). Occurrence counting ("2nd occurrence of 張衡") is computed on the search text of the whole document, in document order — same policy on both sides.

**Anchor resolution tiers.** (1) Fast path: XPath resolves and the node hash matches → use the stored offset. (2) XPath resolves but hash differs → search within that node for the surface string, disambiguating by context. (3) Whole-document search by surface + occurrence index, context as tiebreaker. (4) Otherwise the suggestion is marked `unresolvable` — never applied approximately. Context windows are taken from the *document-level* search-text stream (crossing text-node boundaries), because a tagged name is often a text node containing nothing but the name itself, leaving no node-local context. A candidate only wins re-anchoring with positive, uniquely-best context agreement — a lone surface match with zero matching context is rejected, since the XPath may have drifted onto the wrong node.

**Temporary ids.** In-session anchoring uses the editor's existing DOM ids (leaf-writer's editing representation already assigns HTML `id`s to tags — see `tagger.ts` — which never serialize to XML), so no schema-compatibility issue arises and nothing needs flushing from the XML itself.

**Pending-batch persistence.** Batches persist in a hidden cache folder (pruned after N days) so reviews can resume, but a resumed batch is treated as stale: every suggestion is re-verified through the resolution tiers on load, and failures flip to `unresolvable`. In-memory batches within one session may use temp-ids; persisted ones may not.

**Undo.** Batch apply takes a document snapshot first; a "Revert auto-tagging" affordance is offered until the next manual edit, after which the snapshot is discarded (reverting later would destroy subsequent edits).

**Schema rules, two layers.** (1) Structural validity from the loaded schema automatically (`schemaManager.isTagValidChildOfParent`, checked against the ancestor chain before insertion; full validation after apply catches rare positional cases). (2) User taste rules — schema-allowed but unwanted, e.g. `<date>` in `<placeName>` — in a settings panel: structured `{ tag, notInside }` with dropdowns fed by the schema, raw-XPath escape hatch for power users. Rules block during auto-tagging, warn during audit. Ships empty.

## Base technology

Whatever different methods of autotagging we do, we should use the same set of solid functions for regex, xpath navigation, and validation. I've built such things into sanmiao, so we can look at that package.

Specifically:
- If possible, we insert tags into text nodes to avoid breaking the XML
- We 'deduplicate', removing nested `<persName>` for example.
- We set up schema-based rules to clean tags that go where they shouldn't (e.g., `<date>` inside a `<placeName>`) — checked before insertion where possible.
- After cleanup, we run validation and try to resolve all issues before rebuilding the document and letting the user clean up.

Conflict resolution within a run:
1. Prefer longer span (done)
2. Prefer higher-confidence sources?
3. Prefer known project entities
4. Review of unresolved overlaps

Priority *across* methods (dictionary vs. AI vs. NER on overlapping spans) is set aside for now. The working assumption is sequential passes (e.g., dictionary first, AI audits the result) rather than a competing pool, but no commitment yet.

## East Asian dates

- sanmiao python package, adapted for TEI

## Regex (Dictionary tagging)

At the very least, we should offer the ability to import tables with 'string' and 'tag' columns. We sort by string length, descending, and tag in order.

Sources:
- Spreadsheets (tsv, csv, xlsx, LibreOffice, etc.)
- Internal: crawl project XML to compile an internal list and apply that list
- Authorities: pre-configured occasional dumps from CBDB, DILA, CHGIS APIs (?)

Cut from v1: direct SQL-server connections (connection management, credential storage, user-written queries, streaming). Too much surface area for what is ultimately "get me a two-column list" — the SQL user can export a CSV. Revisit later if there's demand; at most, a "paste a query result" affordance.

## AI mode

Principle: **the AI proposes, the machine applies.** The model never rewrites text. It returns suggestion objects (above); the locator is verbatim string + occurrence index / short context window — not character offsets (unreliable across tokenization) and not model-written regexes (escaping bugs). Verbatim-string-plus-context is trivially verifiable before applying.

**AI suggest**: The user supplies a list of tags. We feed the document (chunked) to the AI with that list; it returns suggestion objects for what it identifies as `<persName>`, etc.

Requirements:
- **Chunking with overlap** for long documents, with sufficient surrounding context to avoid misclassification.
- **One pass, multiple tag types**: a single pass should be able to request several tag types at once — this shapes the JSON response format and keeps costs down. Multi-turn refinement (second pass for a tag type) remains possible but is not the default.
- **Confidence scoring** on every suggestion, filterable by threshold in the review UI.
- **Economy**: cache responses keyed on (chunk hash, tag set, model, prompt version) so re-runs on unchanged text cost nothing; batch requests; only send chunks that changed since the last run.

**AI audit**: take a dumb-tagged document, identify mistakes with a one-sentence rationale, and walk the user through keep/add/correct decisions:
- dumb mode missed something → `add`
- dumb mode incorrectly identified something as a NE → `remove`
- dumb mode used the wrong tag or drew the boundary incorrectly → `retag` / `redraw-boundary`

These are just suggestion objects with different `action` values, reviewed in the same UI as everything else.

**Auto-accept rules**: let users define per-tag trust (e.g., "auto-accept AI `<date>` suggestions above 0.9, always review `<persName>`").

**User feedback**: no trained classifier. A simple decision log (surface form → chosen tag/entity, with counts) in the project entity file gets 90% of the value: it drives defaults ("user corrected 張衡→persName twice, so default to that") and doubles as context for AI ranking.

## NER

The user would supply a language model (?), but this would depend on the language.... the user should do that himself. Future. When it comes, it emits suggestion objects like everything else.

## UI

This is not something that the user will do all the time, so we should maybe handle this with a big popup accessible through a button on the central panel. The review walk itself uses the shared split-screen review UI.

---

# Disambiguation

## Data model

We distinguish:
1. **surface form**: 張衡 as written in the text;
2. **mention**: this specific occurrence of 張衡;
3. **entity**: the person/place/work to which it refers;
4. **authority links**: CBDB, Wikidata, VIAF, DILA, CHGIS, etc.

TEI mapping, explicitly:
- surface form = text content;
- mention = the element (`<persName>` etc.);
- entity = `@key`/`@ref` on the mention, pointing **only to the local project entity** — never directly to an external authority;
- authority links live on the entity record. This keeps the XML stable when authority mappings change.

## Project entity file (the "database")

Not an SQL server. The project database is a TEI standoff file in the project itself: `<standOff>` / personography / placeography (`<listPerson>`, `<listPlace>`, ...) with `xml:id`s as local ids and `<idno type="CBDB">`, `<idno type="wikidata">`, etc. for authority links, plus description fields and cached authority data.

Benefits: self-contained, versionable in git alongside the texts, interoperable with other TEI tooling. If lookup speed becomes an issue we index it into SQLite at runtime — the XML stays the source of truth.

**Important**: this file must be invisible to find, replace, and other whole-project text operations — it's infrastructure, not corpus. Excluded by file role, not by user convention.

The decision log (user's accept/reject/correct history) lives alongside it.

## Norbert paradigm (reference)

In Norbert, I have an SQL database that is my own. First I tag entities, then I add attributes. If there is a one-to-one correspondence, I add that attribute. If it is one-to-many, I add all, separated by `|`. After the first round of tagging, I export a CSV that lists all those individuals that matched with related information (dynasty, where he might have a biography, description, _zi_, etc.). Then:
- Where there is a one-to-one match that is wrong, necessitating the addition of a new person, I remove that item from the table.
- Where there is a one-to-many, I manually deduplicate, leaving only the correct person.
In phase two, I clean the XML attributes based on the table, and those without attributes are exported to a new table, of people to add, which I validate before sending off to the SQL database, getting their new IDs, and then inserting them as attributes.

This works great for me, but I'm not going to set up such a thing for every user. (A future option: let a power user connect his own database — later step, not for everyone.)

## Workflow

When we disambiguate, it will open a version of the 'entities' panel. We'll select what tag we want to disambiguate (`<persName>` only, for example). Each unique string will expand into a tree with instances of that unique string. These can be clicked or keyboard navigated like with find, so that we can immediately see where it is in the text.

When we launch that, we'll query the authorities that the user has chosen, plus the project entity file. Where the project file has linked an id to, say, CBDB and Wikidata, those will be collapsed into one item, mentioning their sources. Each item will provide some basic details to help the user cognitively disambiguate. There will be a button to go to the authority source, e.g. open the Wikipedia page.

Buttons:
- accept for this occurrence;
- accept for all identical strings **in this document** (never corpus-wide — identical surface form ≠ identical entity, especially for Chinese person names; per-instance AI sanity-checking can flag outliers);
- create new entity;
- mark unresolved;
- ignore (X on the tree, moves to the bottom of the list);
- split group.

A filter button at the top of the panel filters out strings in which all instances have ids.

When the author accepts something and there is no custom description of the person, place, etc., in the project entity file, a popup allows him to add one.

Technical:
- cache authority queries;
- send batched requests;
- rate limit, to be polite.

## AI-assisted ranking

We will also integrate AI via API to provide guided choices with a short summary as to why for each case. It draws on the project entity file, cached authority data, and the decision log:

- date range;
- genre;
- nearby names;
- known corpus topic;
- place context;
- dynasty/period words;
- already-resolved entities;
- user's past decisions (the decision log).

The AI outputs a ranking to help the reader make a quick decision, e.g.:
```
1. 張衡, Eastern Han astronomer — likely, because nearby text discusses calendrical instruments.
2. 張衡, Tang official — unlikely, date mismatch.
```
He can click, accept locally or for the whole document, as above. Same caching/batching economy rules as AI mode.

## Anchoring

Disambiguation choices are suggestion objects too, using the same anchor scheme. Within a session, temporary ids on affected nodes are simpler and more robust than re-locating; flush them when we move out of disambiguating that tag-type. Cross-session re-anchoring (via the surface + context + hash fields) is deferred.

# Database

We'll presumably want a viewer/editing tools for the project entity file at some point.... I'll think about that later.
