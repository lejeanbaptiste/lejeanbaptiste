import Dexie, { Table } from 'dexie';
import { Schema } from '../types';

export interface SuspendedDocument {
  content: string;
  uuid: string;
}

export class DexieDB extends Dexie {
  schemas!: Table<Schema>;
  suspendedDocuments!: Table<SuspendedDocument>;

  constructor() {
    super('LEAF-Writer');
    this.version(1).stores({
      schemas: 'id, mapping',
      suspendedDocuments: 'uuid', // Primary key and indexed props
    });
  }
}

export const db = new DexieDB();
