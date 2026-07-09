/**
 * Entity-lookup service backed by the project's entities.xml (the LJB entity
 * database). Registered on desktop and pinned above every external authority
 * so the user's own entities always appear first in the lookup dialog.
 */
import { ENTITY_KINDS, type EntityKind } from '../autoTagging/entities';
import { entityStoreFromDesktop } from '../autoTagging/entityStore';
import type {
  AuthorityLookupParams,
  AuthorityLookupResult,
  AuthorityService,
  NamedEntityType,
} from '../types';

export const ENTITY_DATABASE_SERVICE_ID = 'project-entities';
export const ENTITY_DATABASE_SERVICE_NAME = 'Project entities';

/** URI scheme for internal entity results (never written as @ref). */
export const ENTITY_DATABASE_URI_SCHEME = 'ljb-entity';

export function internalEntityUri(id: string): string {
  return `${ENTITY_DATABASE_URI_SCHEME}://${id}`;
}

export function internalEntityIdFromUri(uri: string): string | null {
  const match = uri.match(new RegExp(`^${ENTITY_DATABASE_URI_SCHEME}://(.+)$`));
  return match ? match[1]! : null;
}

/** Lookup entity types that live in the entity database, mapped to standoff kinds. */
export const LOOKUP_TYPE_TO_KIND: Partial<Record<NamedEntityType, EntityKind>> = {
  person: 'person',
  place: 'place',
  organization: 'org',
  work: 'work',
  citation: 'work',
};

const MAX_RESULTS = 20;

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** CJK-friendly match: either string contains the other (no tokenization). */
function namesMatch(query: string, name: string): boolean {
  if (!query || !name) return false;
  return name.includes(query) || query.includes(name);
}

export function searchEntityDocument(
  doc: Document,
  kind: EntityKind,
  query: string,
): AuthorityLookupResult[] {
  const { item, name: nameTag } = ENTITY_KINDS[kind];
  const normalizedQuery = normalize(query);
  const results: AuthorityLookupResult[] = [];

  const items = doc.getElementsByTagName(item);
  for (let i = 0; i < items.length && results.length < MAX_RESULTS; i++) {
    const el = items.item(i)!;
    const id = el.getAttribute('xml:id');
    if (!id) continue;

    const names: string[] = [];
    const nameEls = el.getElementsByTagName(nameTag);
    for (let j = 0; j < nameEls.length; j++) {
      const text = nameEls.item(j)?.textContent?.trim();
      if (text) names.push(text);
    }
    if (!names.some((name) => namesMatch(normalizedQuery, normalize(name)))) continue;

    const idnos: { type: string; value: string }[] = [];
    const idnoEls = el.getElementsByTagName('idno');
    for (let j = 0; j < idnoEls.length; j++) {
      const idnoEl = idnoEls.item(j)!;
      idnos.push({
        type: idnoEl.getAttribute('type') ?? 'unknown',
        value: idnoEl.textContent?.trim() ?? '',
      });
    }

    let description: string | undefined;
    const noteEls = el.getElementsByTagName('note');
    for (let j = 0; j < noteEls.length; j++) {
      const noteEl = noteEls.item(j)!;
      if (noteEl.getAttribute('type') === 'description') {
        description = noteEl.textContent?.trim() || undefined;
        break;
      }
    }

    results.push({
      label: names[0]!,
      description,
      uri: internalEntityUri(id),
      internal: { id, idnos, description },
    });
  }

  return results;
}

async function search({ query, entityType }: AuthorityLookupParams): Promise<AuthorityLookupResult[]> {
  const kind = LOOKUP_TYPE_TO_KIND[entityType];
  if (!kind) return [];

  const store = entityStoreFromDesktop();
  if (!store) return [];

  const doc = await store.loadEntities();
  return searchEntityDocument(doc, kind, query);
}

/** The entity-database lookup service, or null when not running on desktop. */
export function entityDatabaseLookupService(): AuthorityService | null {
  // Register whenever the desktop file bridge exists — the project (and thus
  // the EntityStore) may open after service registration, so the store is
  // resolved per-search, not here.
  if (typeof window === 'undefined') return null;
  if (!(window as unknown as { electronAPI?: { readFile?: unknown } }).electronAPI?.readFile) {
    return null;
  }

  const entityTypes = new Map(
    (Object.keys(LOOKUP_TYPE_TO_KIND) as NamedEntityType[]).map((name) => [name, { name }]),
  );

  return {
    id: ENTITY_DATABASE_SERVICE_ID,
    name: ENTITY_DATABASE_SERVICE_NAME,
    description: "This project's own entity database (entities.xml)",
    entityTypes,
    isLocal: true,
    search,
  };
}
