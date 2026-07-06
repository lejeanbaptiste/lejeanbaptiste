/** Pre-compiled NDJSON packs under `<entityDbFolder>/authority-packs/`. */

export const AUTHORITY_PACKS_DIRNAME = 'authority-packs';

export type AuthorityPackId =
  | 'cbdb-persons'
  | 'cbdb-places'
  | 'cbdb-offices'
  | 'dila-persons'
  | 'dila-places'
  | 'chgis-places'
  | 'wikidata-persons-tang'
  | 'wikidata-persons-ming'
  | 'wikidata-persons-qing'
  | 'wikidata-persons-pre-ming'
  | 'ndl-persons'
  | 'ndl-works';

export interface AuthorityPackSpec {
  id: AuthorityPackId;
  label: string;
  source: 'cbdb' | 'dila' | 'chgis' | 'wikidata' | 'ndl';
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
    id: 'chgis-places',
    label: 'CHGIS historical places',
    source: 'chgis',
    relativePath: 'chgis/places.ndjson',
    defaultTag: 'placeName',
  },
  {
    id: 'wikidata-persons-tang',
    label: 'Wikidata persons (Tang, zh-hant)',
    source: 'wikidata',
    relativePath: 'wikidata/person-zh-hant-tang/persons.ndjson',
    defaultTag: 'persName',
  },
  {
    id: 'wikidata-persons-ming',
    label: 'Wikidata persons (Ming, zh-hant)',
    source: 'wikidata',
    relativePath: 'wikidata/person-zh-hant-ming/persons.ndjson',
    defaultTag: 'persName',
  },
  {
    id: 'wikidata-persons-qing',
    label: 'Wikidata persons (Qing, zh-hant)',
    source: 'wikidata',
    relativePath: 'wikidata/person-zh-hant-qing/persons.ndjson',
    defaultTag: 'persName',
  },
  {
    id: 'wikidata-persons-pre-ming',
    label: 'Wikidata persons (pre-Ming, zh-hant)',
    source: 'wikidata',
    relativePath: 'wikidata/person-zh-hant-pre-ming/persons.ndjson',
    defaultTag: 'persName',
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

/** Display order for authority pack checkboxes (grouped by entity type, not source). */
export const AUTHORITY_TAG_TYPE_GROUP_ORDER = [
  'persName',
  'placeName',
  'roleName',
  'title',
] as const;

export const AUTHORITY_TAG_TYPE_GROUP_LABELS: Record<
  (typeof AUTHORITY_TAG_TYPE_GROUP_ORDER)[number],
  string
> = {
  persName: 'Persons',
  placeName: 'Places',
  roleName: 'Offices / roles',
  title: 'Works',
};

export interface AuthorityPackTypeGroup {
  tag: (typeof AUTHORITY_TAG_TYPE_GROUP_ORDER)[number];
  label: string;
  packs: AuthorityPackSpec[];
}

/** Group visible pack specs by TEI tag type (persName, placeName, …). */
export function groupAuthorityPacksByTagType(
  packIds: AuthorityPackId[],
): AuthorityPackTypeGroup[] {
  const specs = packIds
    .map((id) => AUTHORITY_PACKS.find((p) => p.id === id))
    .filter((p): p is AuthorityPackSpec => !!p);
  const groups: AuthorityPackTypeGroup[] = [];
  for (const tag of AUTHORITY_TAG_TYPE_GROUP_ORDER) {
    const packs = specs.filter((p) => p.defaultTag === tag);
    if (packs.length > 0) {
      groups.push({ tag, label: AUTHORITY_TAG_TYPE_GROUP_LABELS[tag], packs });
    }
  }
  return groups;
}
