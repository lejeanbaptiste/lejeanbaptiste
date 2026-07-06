/** Pre-compiled NDJSON packs under `<entityDbFolder>/authority-packs/`. */

export const AUTHORITY_PACKS_DIRNAME = 'authority-packs';

export type AuthorityPackId =
  | 'cbdb-persons'
  | 'cbdb-places'
  | 'cbdb-offices'
  | 'dila-persons'
  | 'dila-places'
  | 'ndl-persons'
  | 'ndl-works';

export interface AuthorityPackSpec {
  id: AuthorityPackId;
  label: string;
  source: 'cbdb' | 'dila' | 'ndl';
  relativePath: string;
  defaultTag: string;
}

export const AUTHORITY_PACKS: AuthorityPackSpec[] = [
  {
    id: 'cbdb-persons',
    label: 'CBDB persons',
    source: 'cbdb',
    relativePath: 'cbdb/persons.ndjson',
    defaultTag: 'persName',
  },
  {
    id: 'cbdb-places',
    label: 'CBDB places',
    source: 'cbdb',
    relativePath: 'cbdb/places.ndjson',
    defaultTag: 'placeName',
  },
  {
    id: 'cbdb-offices',
    label: 'CBDB offices (官名)',
    source: 'cbdb',
    relativePath: 'cbdb/offices.ndjson',
    defaultTag: 'roleName',
  },
  {
    id: 'dila-persons',
    label: 'DILA persons',
    source: 'dila',
    relativePath: 'dila/persons.ndjson',
    defaultTag: 'persName',
  },
  {
    id: 'dila-places',
    label: 'DILA places',
    source: 'dila',
    relativePath: 'dila/places.ndjson',
    defaultTag: 'placeName',
  },
  {
    id: 'ndl-persons',
    label: 'NDL persons',
    source: 'ndl',
    relativePath: 'ndl/persons.ndjson',
    defaultTag: 'persName',
  },
  {
    id: 'ndl-works',
    label: 'NDL works',
    source: 'ndl',
    relativePath: 'ndl/works.ndjson',
    defaultTag: 'title',
  },
];

export interface AuthorityPackSelection {
  packs: AuthorityPackId[];
  yearRange?: { start: number; end: number };
  hideUndated?: boolean;
}

export interface AuthorityPackStatus {
  id: AuthorityPackId;
  label: string;
  installed: boolean;
  bytes?: number;
  entityCount?: number;
}

export function packPath(baseFolder: string, packId: AuthorityPackId): string {
  const spec = AUTHORITY_PACKS.find((p) => p.id === packId);
  if (!spec) throw new Error(`Unknown pack: ${packId}`);
  const sep = baseFolder.includes('\\') ? '\\' : '/';
  return `${baseFolder.replace(/[/\\]+$/, '')}${sep}${AUTHORITY_PACKS_DIRNAME}${sep}${spec.relativePath.replace(/\//g, sep)}`;
}

export function packsRoot(baseFolder: string): string {
  const sep = baseFolder.includes('\\') ? '\\' : '/';
  return `${baseFolder.replace(/[/\\]+$/, '')}${sep}${AUTHORITY_PACKS_DIRNAME}`;
}
