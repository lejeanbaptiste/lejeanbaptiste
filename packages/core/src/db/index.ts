import Dexie, { Table } from 'dexie';

export interface SuspendedDocument {
  id?: number;
  content: string;
}

export class DexieDB extends Dexie {
  suspendedDocument!: Table<SuspendedDocument>;

  constructor() {
    super('LEAF-Writer');
    this.version(1).stores({
      suspendedDocument: '++id', // Primary key and indexed props
    });
  }
}

export const db = new DexieDB();
