import Dexie, { Table } from 'dexie';
import { AuthorityService } from '../dialogs';
import type { Schema } from '../types';
import {
  clearCache as clearCacheValidator,
  deleteDb as deleteDbValidator,
} from '@cwrc/leafwriter-validator/db';

export interface SuspendedDocument {
  content: string;
  uuid: string;
}

export interface DoNotDisplayDialogs {
  id: string;
}

export class DexieDB extends Dexie {
  authorityServices!: Table<Omit<AuthorityService, 'find'>>;
  customSchemas!: Table<Schema>;
  doNotDisplayDialogs!: Table<DoNotDisplayDialogs>;
  suspendedDocuments!: Table<SuspendedDocument>;

  constructor() {
    super('LEAF-Writer');
    this.version(1).stores({
      authorityServices: 'id, lookupService',
      customSchemas: 'id, mapping',
      doNotDisplayDialogs: 'id',
      suspendedDocuments: 'uuid',
    });
  }
}

export const db = new DexieDB();

export const clearCache = async () => {
  await clearCacheValidator();
  await db.suspendedDocuments
    .clear()
    .catch(() => new Error('Clear `suspendedDocuments` table: Something went wrong.'));
  await db.customSchemas
    .clear()
    .catch(() => new Error('Clear `customSchemas` table: Something went wrong.'));
  await db.authorityServices
    .clear()
    .catch(() => new Error('Clear `authorityServices` table: Something went wrong.'));
  await db.doNotDisplayDialogs
    .clear()
    .catch(() => new Error('Clear `doNotDisplayDialogs` table: Something went wrong.'));
};

export const deleteDb = async () => {
  await deleteDbValidator();
  return await db.delete().catch(() => new Error('Something went wrong.'));
};
