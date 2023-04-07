import { jest } from '@jest/globals';
import { cachedSchema } from './cwtcTeiLite';

//@ts-ignore
jest.spyOn(db.cachedSchemas, 'get').mockImplementation(async () => cachedSchema);
