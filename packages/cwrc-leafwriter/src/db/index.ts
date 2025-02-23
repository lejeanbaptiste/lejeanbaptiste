// * Package Exports is only available when TSconfig nodeModuleRosultuon is set to NODE16 or NODENEXT.
// * But, this new configuration means different setup to load dependencies, which might break other things.
// * We should way a little longer to adopt the new setup

import Dexie, { Table } from 'dexie';
import type { LocalAuthorityServiceConfig, LookupServicePreference, Schema } from '../types';

export interface SuspendedDocument {
  content: string;
  uuid: string;
}

export interface DoNotDisplayDialogs {
  id: string;
}

export class DexieDB extends Dexie {
  customAuthorityServices!: Table<LocalAuthorityServiceConfig>;
  customSchemas!: Table<Schema>;
  doNotDisplayDialogs!: Table<DoNotDisplayDialogs>;
  lookupServicePreferences!: Table<LookupServicePreference>;
  suspendedDocuments!: Table<SuspendedDocument>;

  constructor() {
    super('LEAF-Writer');
    this.version(1).stores({
      suspendedDocument: '++id',
    });
    this.version(2).stores({
      authorityServices: 'id, lookupService',
      customSchemas: 'id, mapping',
      doNotDisplayDialogs: 'id',
      suspendedDocuments: 'uuid',
      suspendedDocument: null,
    });
    this.version(3)
      .stores({
        authorityServices: 'id',
        customSchemas: 'id, mapping',
        doNotDisplayDialogs: 'id',
        suspendedDocuments: 'uuid',
      })
      .upgrade((tx) => {
        // return tx.table('authorityServices').toCollection().delete();
        return tx
          .table('authorityServices')
          .toCollection()
          .modify((authorityService) => {
            authorityService.disabled = authorityService.enabled;
            authorityService.serviceSource = authorityService.id !== 'lgpn' ? 'LINCS' : 'custom';
            authorityService.serviceType = 'API';
            delete authorityService.enabled;
            delete authorityService.lookupService;
          });
      });
    this.version(4).stores({
      authorityServices: null,
      customAuthorityServices: 'id, searchType',
      customSchemas: 'id, mapping',
      doNotDisplayDialogs: 'id',
      lookupServicePreferences: 'id, authorityId, entityType, priority',
      suspendedDocuments: 'uuid',
    });
  }
}

export const db = new DexieDB();

export const clearCache = async () => {
  await db.customAuthorityServices
    .clear()
    .catch(() => new Error('Clear `customAuthorityService` table: Something went wrong.'));
  await db.customSchemas
    .clear()
    .catch(() => new Error('Clear `customSchemas` table: Something went wrong.'));
  await db.doNotDisplayDialogs
    .clear()
    .catch(() => new Error('Clear `doNotDisplayDialogs` table: Something went wrong.'));
  await db.lookupServicePreferences
    .clear()
    .catch(() => new Error('Clear `lookupServices` table: Something went wrong.'));
  await db.suspendedDocuments
    .clear()
    .catch(() => new Error('Clear `suspendedDocuments` table: Something went wrong.'));

  await window.leafwriterValidator?.clearCache();
};

export const deleteDb = async () => {
  return await db.delete().catch(() => new Error('Something went wrong.'));
};
