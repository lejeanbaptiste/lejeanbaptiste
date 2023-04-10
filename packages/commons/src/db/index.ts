import {
  clearCache as clearCacheLeafwriter,
  deleteDb as deleteDbLeafwriter,
} from '@cwrc/leafwriter';
import {
  clearCache as clearCacheStorageService,
  deleteDb as deleteDbStorageService,
} from '@cwrc/leafwriter-storage-service';
import type { Resource } from '@src/types';
import Dexie, { Table } from 'dexie';

export class DexieDB extends Dexie {
  recentDocuments!: Table<Resource, string>;

  constructor() {
    super('LEAF-Writer-Commons');
    this.version(1).stores({
      recentDocuments: 'id, &url', // '&' means 'unique'
    });
  }
}

export const db = new DexieDB();

export const clearCache = async () => {
  await clearCacheLeafwriter();
  await clearCacheStorageService();
  await db.recentDocuments
    .clear()
    .catch(() => new Error('Clear `recentDocuments` table: Something went wrong.'));
};

export const deleteDb = async () => {
  await deleteDbLeafwriter();
  await deleteDbStorageService();
  return await db.delete().catch(() => new Error('Something went wrong.'));
};
