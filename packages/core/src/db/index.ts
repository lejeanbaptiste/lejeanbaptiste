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
      authorityServices: 'id, lookupService',
      customSchemas: 'id, mapping',
      doNotDisplayDialogs: 'id',
      suspendedDocuments: 'uuid',
    });
  }
}

export const db = new DexieDB();
