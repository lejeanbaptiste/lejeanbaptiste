// * Packege Exports is only available when TSconfig nodeModuleRosultuon is set to NODE16 or NODENEXT.
// * But, this new configuration means different setup to load dependencies, which might break other things.
// * We should way a little longer to adopt the new setup

import Dexie, { Table } from 'dexie';
import { AuthorityService } from '../dialogs';
import type { Schema } from '../types';

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
      suspendedDocument: '++id',
    });
    this.version(2)
      .stores({
        authorityServices: 'id, lookupService',
        customSchemas: 'id, mapping',
        doNotDisplayDialogs: 'id',
        suspendedDocuments: 'uuid',
      })
      .upgrade((tx) => {
        return tx
          .table('suspendedDocuments')
          .toCollection()
          .modify((suspendedDocuments) => {
            suspendedDocuments.uuid = suspendedDocuments.id;
            delete suspendedDocuments.id;
          });
      });
  }
}

export const db = new DexieDB();

export const clearCache = async () => {
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
  return await db.delete().catch(() => new Error('Something went wrong.'));
};
