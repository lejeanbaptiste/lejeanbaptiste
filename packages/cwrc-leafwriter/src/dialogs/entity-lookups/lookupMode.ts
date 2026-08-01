import type { DesktopEntityStoreGlobals } from '../../autoTagging/entityStore';
import { CENTRAL_ENTITY_DATABASE_SERVICE_ID } from '../../services/central-entity-database-lookup';
import { ENTITY_DATABASE_SERVICE_ID } from '../../services/entity-database-lookup';

/** Whether this project mirrors PEDB into the CEDB. */
export const projectSyncsToCentral = (): boolean =>
  (window as unknown as DesktopEntityStoreGlobals).__ljbLspProject?.syncToCentral === true;

/**
 * Which own-database lookup services belong in this dialog opening.
 * Attach-to-entity: none. Tagging + sync: CEDB only. Tagging without sync: PEDB only.
 */
export const allowedOwnDatabaseServiceIds = (
  attachToEntityId: string | undefined,
  syncToCentral: boolean,
): ReadonlySet<string> => {
  if (attachToEntityId) return new Set();
  if (syncToCentral) return new Set([CENTRAL_ENTITY_DATABASE_SERVICE_ID]);
  return new Set([ENTITY_DATABASE_SERVICE_ID]);
};
