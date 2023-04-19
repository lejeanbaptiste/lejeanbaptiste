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


export const clearCache = async () => {
  return await db.publicRepositories.clear().catch(() => new Error('Something went wrong.'));
};

export const deleteDb = async () => {
  return await db.delete().catch(() => new Error('Something went wrong.'));
};