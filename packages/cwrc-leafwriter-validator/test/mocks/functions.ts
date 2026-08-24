import { jest } from '@jest/globals';
import { cachedSchema } from './cwtcTeiLite';

// @ts-expect-error -- `db` is injected by the validator test environment.
jest.spyOn(db.cachedSchemas, 'get').mockImplementation(async () => cachedSchema);
