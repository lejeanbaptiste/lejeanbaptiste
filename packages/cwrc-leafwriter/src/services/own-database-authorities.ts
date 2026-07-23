/**
 * Shared identity for the two "own data" lookup sources — the project entity
 * database (PEDB) and the user's central entity database (CEDB). Both are
 * always consulted in disambiguation (never user-disableable) and are called
 * out visually ahead of external authorities.
 */
import { ENTITY_DATABASE_SERVICE_ID } from './entity-database-lookup';
import { CENTRAL_ENTITY_DATABASE_SERVICE_ID } from './central-entity-database-lookup';

export const OWN_DATABASE_SERVICE_IDS: ReadonlySet<string> = new Set([
  ENTITY_DATABASE_SERVICE_ID,
  CENTRAL_ENTITY_DATABASE_SERVICE_ID,
]);

export const isOwnDatabaseService = (authorityId: string): boolean =>
  OWN_DATABASE_SERVICE_IDS.has(authorityId);

/** Two-letter initials shown as the icon for an own-database source. */
export const OWN_DATABASE_INITIALS: Record<string, string> = {
  [ENTITY_DATABASE_SERVICE_ID]: 'PE',
  [CENTRAL_ENTITY_DATABASE_SERVICE_ID]: 'CE',
};
