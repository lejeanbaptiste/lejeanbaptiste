import type { Resource } from '@src/types';
import Dexie, { Table } from 'dexie';

export class DexieDB extends Dexie {
  recentDocuments!: Table<Resource, string>;

  constructor() {
    super('LEAF-Writer-Commons');
    this.version(1).stores({
      recentDocuments: 'id, &url',
    });
  }
}

export const db = new DexieDB();

export const resetDatabase = async () => {
  await db.transaction('rw', db.recentDocuments, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
};
