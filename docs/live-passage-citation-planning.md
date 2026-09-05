# Live passage citations (Word / LibreOffice) — planning notes

**Status (2026-08-04):** **Dream / planning only** — not implemented. Entity fields in the Word add-in already prove the pattern; passage citations would reuse it over translation units (`xml:id` + companion `@corresp`). No new tags in source TEI.

## Goal

From Word (and later LibreOffice), insert a **live field** that pulls:

- primary-source text for an alignment unit,
- optional translation for a language,
- bibliography / work citation,
- page cue (nearest `<pb>` when present),

and **Sync with Grognard** refreshes the visible text when the project edits punctuation, translation, or metadata — like Zotero citation refresh, richer than a one-shot CBeta-style copy.

Grognard remains the source of truth. Word/LO only store **pointers** (content-control / reference-mark tags), not a second copy of the edition.

## What already exists

| Piece                 | Where                                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alignment units + ids | Source TEI `xml:id` on `p`/`div` (translation bootstrap)                                                                                                                               |
| Translation text      | Companion `*.lang.translation.xml` with `@corresp="file.xml#id"`                                                                                                                       |
| Word entity fields    | [`wordprocessor/src/wordFields.ts`](../../wordprocessor/src/wordFields.ts) — content controls tagged `{ entryId, fieldType, displayFormat }`, Sync via `GET /api/plugins/entities/:id` |
| Plugin HTTPS API      | [`apps/commons/src-server/routes/plugins.ts`](../apps/commons/src-server/routes/plugins.ts) — Bearer token, read-only today                                                            |

See also [translation-planning.md](translation-planning.md) (card reader / linking model).

## Proposed API (leaf-writer)

Same auth/CORS/HTTPS shell as entities. **New** capability: read project XML (entities API today only touches SQLite).

```text
GET /api/plugins/passages/search?q=&file=&lang=&limit=
GET /api/plugins/passages/:id
```

Suggested id form: `sourceFileName#unitId` (URL-encoded), e.g. `juan02.xml#p-0042`.

```ts
interface PassageSummary {
  id: string; // "juan02.xml#p-0042"
  sourceFile: string;
  unitId: string;
  sourceText: string; // plain or lightly marked
  translations?: Array<{ lang: string; text: string }>;
  bibl?: {
    title?: string;
    author?: string;
    // from teiHeader / project edition metadata
  };
  page?: string | null; // nearest preceding pb/@n when available
}
```

Search: filter by file, optional language (prefer companions that exist), substring over source unit text.

## Word add-in (wordprocessor)

Mirror entities:

1. Content-control `tag` JSON, e.g. `{ kind: 'passage', passageId, include: ['source','translation','bibl','page'], lang?, layout? }`.
2. In-memory cache of `PassageSummary`; display renderer (blockquote source + translation; bibl/page in body or footnote).
3. Extend `grognardApi.ts` with `fetchPassage` / `searchPassages`.
4. Extend Sync to refresh passage fields; missing units → `[Passage not found]` (same spirit as `[Entity not found]`).

**Do not** write TEI from Word. Footnotes: start with bibl as a second control or plain footnote text from the payload; true Word footnote API can come later.

## LibreOffice

Same payload; render with **reference marks** (Zotero LO naming pattern already referenced in Grognard `documentExport.ts`). Thin second client, shared Grognard API.

## Phasing (when built)

1. Grognard: `GET passages/:id` + search over open project files / companions.
2. Word: insert + Sync for passage fields (reuse unlock/edit/relock).
3. Footnote / citation-style polish.
4. LibreOffice mirror.
5. Optional CSL-like templates for bibl layout — last.

## Explicit non-goals (for now)

- Embedding translation into the source TEI for Word
- Stamping Word field ids into TEI
- Sentence-level auto-align
- Dual facing-page UI inside Grognard (card reader is enough for authoring)

## Open questions

1. **Bibl source:** project edition metadata vs per-file `teiHeader` vs both with override.
2. **Page:** nearest preceding `pb/@n` in source vs edition page mapping tables.
3. **Id drift:** split paragraphs / reindex — fields break until Sync flags missing (acceptable if documented).
4. **Offline:** Sync fails cleanly when Grognard is closed (same as entities).

## Pointer for implementers

Consumer how-to stays in the [wordprocessor README](../../wordprocessor/README.md); this doc is the cross-cutting plan. When implementing, start from `wordFields.ts` + `plugins.ts`, not a new storage model.
