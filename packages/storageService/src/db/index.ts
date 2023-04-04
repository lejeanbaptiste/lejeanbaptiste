import type { PublicRepository } from '../types';
import Dexie, { Table } from 'dexie';


export class DexieDB extends Dexie {
  publicRepositories!: Table<PublicRepository, string>;

  constructor() {
    super('LEAF-Writer-Storage-Service');
    this.version(1).stores({
      publicRepositories: 'uuid, provider, type, username',
    });
  }
}

export const db = new DexieDB();

export const resetDatabase = async () => {
  await db.transaction('rw', db.publicRepositories, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
};
