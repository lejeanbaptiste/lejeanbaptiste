import type { AuthorityCandidate } from './authority';
import { ENTITY_KINDS, parseIsoYear, type EntityKind } from './entities';
import {
  phase1SearchStringsFromCandidate,
  resolveNameTypeTaggingPolicy,
  type NameTypeTaggingPolicy,
} from './nameTypeTaggingPolicy';

/** Parse the `<note type="dates">start/end</note>` written by `addEntity` for non-person kinds. */
function datesFromNote(note: string | null | undefined): { startYear?: number; endYear?: number } {
  if (!note) return {};
  const [startRaw, endRaw] = note.split('/');
  const startYear = parseIsoYear(startRaw);
  const endYear = parseIsoYear(endRaw);
  const meta: { startYear?: number; endYear?: number } = {};
  if (startYear != null) meta.startYear = startYear;
  if (endYear != null) meta.endYear = endYear;
  return meta;
}

/**
 * Bulk-convert one entity kind's items in a PEDB/CEDB `entities.xml` document
 * into {@link AuthorityCandidate}s, so the project/central databases can feed
 * the same seed-index tag bomb as NDJSON authority packs. Mirrors the read
 * side of `searchEntityDocument` (`services/entity-database-lookup.ts`), but
 * bulk (no query filter) — dates parsed the way `addEntity` writes them
 * (`entities.ts`): `<birth>`/`<death>` for persons, `<note type="dates">`
 * for place/org/work.
 */
export function candidatesFromEntityDatabase(
  doc: Document,
  kind: EntityKind,
  source: 'PEDB' | 'CEDB',
  policy?: NameTypeTaggingPolicy,
): AuthorityCandidate[] {
  const namePolicy = policy ?? resolveNameTypeTaggingPolicy(undefined, null);
  const { item, name: nameTag } = ENTITY_KINDS[kind];
  const candidates: AuthorityCandidate[] = [];

  const items = doc.getElementsByTagName(item);
  for (let i = 0; i < items.length; i++) {
    const el = items.item(i)!;
    const id = el.getAttribute('xml:id');
    if (!id) continue;

    const searchStrings: string[] = [];
    const names: { text: string; type?: string }[] = [];
    const nameEls = el.getElementsByTagName(nameTag);
    for (let j = 0; j < nameEls.length; j++) {
      const nameEl = nameEls.item(j);
      const text = nameEl?.textContent?.trim();
      if (!text) continue;
      const type = nameEl?.getAttribute('type') ?? undefined;
      names.push(type ? { text, type } : { text });
      if (!searchStrings.includes(text)) searchStrings.push(text);
    }
    const filteredSearchStrings = phase1SearchStringsFromCandidate(
      { searchStrings, names },
      namePolicy,
    );
    if (filteredSearchStrings.length === 0) continue;

    let description: string | undefined;
    let dates: { startYear?: number; endYear?: number } = {};
    const noteEls = el.getElementsByTagName('note');
    for (let j = 0; j < noteEls.length; j++) {
      const noteEl = noteEls.item(j)!;
      const type = noteEl.getAttribute('type');
      if (type === 'description' && description == null) {
        description = noteEl.textContent?.trim() || undefined;
      } else if (type === 'dates') {
        dates = datesFromNote(noteEl.textContent);
      }
    }

    if (kind === 'person') {
      const birth = el.getElementsByTagName('birth')[0]?.getAttribute('when');
      const death = el.getElementsByTagName('death')[0]?.getAttribute('when');
      const startYear = parseIsoYear(birth);
      const endYear = parseIsoYear(death);
      if (startYear != null) dates.startYear = startYear;
      if (endYear != null) dates.endYear = endYear;
    }

    const metadata: AuthorityCandidate['metadata'] = {};
    if (description) metadata.description = description;
    if (dates.startYear != null) metadata.startYear = dates.startYear;
    if (dates.endYear != null) metadata.endYear = dates.endYear;

    candidates.push({
      source,
      authorityId: id,
      kind,
      primaryName: filteredSearchStrings[0]!,
      searchStrings: filteredSearchStrings,
      ...(kind === 'person' && names.length > 0 ? { names } : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    });
  }

  return candidates;
}
