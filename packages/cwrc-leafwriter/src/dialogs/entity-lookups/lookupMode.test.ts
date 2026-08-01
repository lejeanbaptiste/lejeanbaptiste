import {
  allowedOwnDatabaseServiceIds,
  projectSyncsToCentral,
} from './lookupMode';
import { CENTRAL_ENTITY_DATABASE_SERVICE_ID } from '../../services/central-entity-database-lookup';
import { ENTITY_DATABASE_SERVICE_ID } from '../../services/entity-database-lookup';

describe('lookupMode', () => {
  it('hides PEDB and CEDB when attaching an authority to an existing entity', () => {
    expect([...allowedOwnDatabaseServiceIds('person-1', true)]).toEqual([]);
    expect([...allowedOwnDatabaseServiceIds('person-1', false)]).toEqual([]);
  });

  it('offers CEDB only when tagging with syncToCentral', () => {
    expect([...allowedOwnDatabaseServiceIds(undefined, true)]).toEqual([
      CENTRAL_ENTITY_DATABASE_SERVICE_ID,
    ]);
  });

  it('offers PEDB only when tagging without syncToCentral', () => {
    expect([...allowedOwnDatabaseServiceIds(undefined, false)]).toEqual([
      ENTITY_DATABASE_SERVICE_ID,
    ]);
  });

  it('reads syncToCentral from the desktop project bridge', () => {
    const previous = (window as unknown as { __ljbLspProject?: unknown }).__ljbLspProject;
    (window as unknown as { __ljbLspProject: { syncToCentral: boolean } }).__ljbLspProject = {
      syncToCentral: true,
    };
    expect(projectSyncsToCentral()).toBe(true);
    (window as unknown as { __ljbLspProject: { syncToCentral: boolean } }).__ljbLspProject = {
      syncToCentral: false,
    };
    expect(projectSyncsToCentral()).toBe(false);
    (window as unknown as { __ljbLspProject?: unknown }).__ljbLspProject = previous;
  });
});
