import {
  clearCache as clearCacheLeafwriter,
  deleteDb as deleteDbLeafwriter,
} from '@cwrc/leafwriter';
import {
  clearCache as clearCacheStorageService,
  deleteDb as deleteDbStorageService,
} from '@cwrc/leafwriter-storage-service';
import type { DocumentRequested, Resource } from '@src/types';
import Dexie, { Table } from 'dexie';

export class DexieDB extends Dexie {
  documentRequested!: Table<DocumentRequested, string>;
  recentDocuments!: Table<Resource, string>;

  constructor() {
    super('LEAF-Writer-Commons');
    this.version(1).stores({
      documentRequested: 'id, expires',
      recentDocuments: 'id, &url', // '&' means 'unique'
    });
  }
}

export const db = new DexieDB();

export const clearCache = async () => {
  await clearCacheLeafwriter();
  await clearCacheStorageService();
  await db.documentRequested
    .clear()
    .catch(() => new Error('Clear `documentRequested` table: Something went wrong.'));
  await db.recentDocuments
    .clear()
    .catch(() => new Error('Clear `recentDocuments` table: Something went wrong.'));
};

export const deleteDb = async () => {
  await deleteDbLeafwriter();
  await deleteDbStorageService();
  return await db.delete().catch(() => new Error('Something went wrong.'));
};
