/**
 * Entity-lookup service backed by the user's central entity database (CEDB) —
 * the personal, cross-project entities.xml configured in App Settings.
 * Registered alongside the project entity database so the user's own data
 * (project + central) is always consulted in disambiguation, ahead of every
 * external authority. See `entity-database-lookup.ts` for the project (PEDB)
 * counterpart; a result's uri scheme (`ljb-central-entity://` vs
 * `ljb-entity://`) is how the disambiguation dialog tells the two apart.
 */
import { centralEntityStoreFromDesktop } from '../autoTagging/entityStore';
import type { AuthorityLookupParams, AuthorityLookupResult, AuthorityService, NamedEntityType } from '../types';
import {
  internalEntityIdFromUri,
  LOOKUP_TYPE_TO_KIND,
  searchEntityDocument,
} from './entity-database-lookup';

export const CENTRAL_ENTITY_DATABASE_SERVICE_ID = 'central-entities';
export const CENTRAL_ENTITY_DATABASE_SERVICE_NAME = 'Central entities';

/** URI scheme for central-database results (never written as @ref). */
export const CENTRAL_ENTITY_URI_SCHEME = 'ljb-central-entity';

export function centralEntityUri(id: string): string {
  return `${CENTRAL_ENTITY_URI_SCHEME}://${id}`;
}

export function centralEntityIdFromUri(uri: string): string | null {
  const match = uri.match(new RegExp(`^${CENTRAL_ENTITY_URI_SCHEME}://(.+)$`));
  return match ? match[1]! : null;
}

/** True when `uri` identifies a central-database (CEDB) result. */
export function isCentralEntityUri(uri: string): boolean {
  return centralEntityIdFromUri(uri) !== null;
}

async function search({ query, entityType }: AuthorityLookupParams): Promise<AuthorityLookupResult[]> {
  const kind = LOOKUP_TYPE_TO_KIND[entityType];
  if (!kind) return [];

  const store = centralEntityStoreFromDesktop(null);
  if (!store) return [];

  const doc = await store.loadEntities();
  return searchEntityDocument(doc, kind, query).map((result) => {
    const id = internalEntityIdFromUri(result.uri) ?? result.internal?.id;
    return id ? { ...result, uri: centralEntityUri(id) } : result;
  });
}

/** The central-database lookup service, or null when not running on desktop. */
export function centralEntityDatabaseLookupService(): AuthorityService | null {
  if (typeof window === 'undefined') return null;
  if (!(window as unknown as { electronAPI?: { readFile?: unknown } }).electronAPI?.readFile) {
    return null;
  }

  const entityTypes = new Map(
    (Object.keys(LOOKUP_TYPE_TO_KIND) as NamedEntityType[]).map((name) => [name, { name }]),
  );

  return {
    id: CENTRAL_ENTITY_DATABASE_SERVICE_ID,
    name: CENTRAL_ENTITY_DATABASE_SERVICE_NAME,
    description: "The user's central entity database, shared across projects",
    entityTypes,
    isLocal: true,
    search,
  };
}
