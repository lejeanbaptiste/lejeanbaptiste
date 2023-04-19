import Dexie, { type Table } from 'dexie';
import type { CachedSchema } from '../types';

export const DB_NAME = 'LEAF-Writer-Validator';

export class DexieDB extends Dexie {
  cachedSchemas!: Table<CachedSchema>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      cachedSchemas: 'id, url',
    });
  }
}

export const db = new DexieDB();

export const clearCache = async () => {
  return await db.cachedSchemas.clear().catch(() => new Error('Something went wrong.'));
};

export const deleteDb = async () => {
  return await db.delete().catch(() => new Error('Something went wrong.'));
};
