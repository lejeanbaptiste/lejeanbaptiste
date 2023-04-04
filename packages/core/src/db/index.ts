import Dexie, { Table } from 'dexie';

export interface SuspendedDocument {
  content: string;
  uuid: string;
}

export class DexieDB extends Dexie {
  suspendedDocument!: Table<SuspendedDocument>;

  constructor() {
    super('LEAF-Writer');
    this.version(1).stores({
      suspendedDocument: 'uuid', // Primary key and indexed props
    });
  }
}

export const db = new DexieDB();
