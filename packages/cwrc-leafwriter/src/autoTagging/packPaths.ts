/** Pre-compiled NDJSON packs under `<entityDbFolder>/authority-packs/`. */

export const AUTHORITY_PACKS_DIRNAME = 'authority-packs';

export type AuthorityPackId =
  | 'cbdb-persons'
  | 'cbdb-places'
  | 'cbdb-offices'
  | 'dila-persons'
  | 'dila-places'
  | 'chgis-places'
  /** UI-only: expands to {@link WIKIDATA_PERSON_CHILD_PACK_IDS} at load time. */
  | 'wikidata-persons'
  | 'wikidata-persons-ming'
  | 'wikidata-persons-qing'
  | 'wikidata-persons-pre-ming'
  | 'wikidata-persons-ja'
  | 'wikidata-persons-bo'
  | 'wikidata-places-bo'
  | 'wikidata-orgs-zh-hant'
  | 'wikidata-orgs-ja'
  | 'wikidata-orgs-bo'
  | 'wikidata-works-zh-hant'
  | 'wikidata-works-ja'
  | 'ndl-persons'
  | 'ndl-places'
  | 'ndl-orgs'
  | 'ndl-works';

/** Dynasty-scoped Wikidata NDJSON packs (installed separately; selected via `wikidata-persons`). */
export const WIKIDATA_PERSON_CHILD_PACK_IDS = [
  'wikidata-persons-pre-ming',
  'wikidata-persons-ming',
  'wikidata-persons-qing',
] as const satisfies readonly AuthorityPackId[];

const WIKIDATA_PERSON_CHILD_SET = new Set<AuthorityPackId>(WIKIDATA_PERSON_CHILD_PACK_IDS);

export interface AuthorityPackSpec {
  id: AuthorityPackId;
  label: string;
  source: 'cbdb' | 'dila' | 'chgis' | 'wikidata' | 'ndl';
  relativePath: string;
  defaultTag: string;
  /** When true, {@link expandAuthorityPackIds} loads {@link WIKIDATA_PERSON_CHILD_PACK_IDS}. */
  virtual?: boolean;
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
    id: 'wikidata-persons',
    label: 'Wikidata persons',
    source: 'wikidata',
    relativePath: '',
    defaultTag: 'persName',
    virtual: true,
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
    id: 'wikidata-persons-ja',
    label: 'Wikidata persons (Japan, ja)',
    source: 'wikidata',
    relativePath: 'wikidata/person-ja-japan/persons.ndjson',
    defaultTag: 'persName',
  },
  {
    id: 'wikidata-persons-bo',
    label: 'Wikidata persons (bo)',
    source: 'wikidata',
    relativePath: 'wikidata/person-bo/persons.ndjson',
    defaultTag: 'persName',
  },
  {
    id: 'wikidata-places-bo',
    label: 'Wikidata places (bo)',
    source: 'wikidata',
    relativePath: 'wikidata/place-bo/places.ndjson',
    defaultTag: 'placeName',
  },
  {
    id: 'wikidata-orgs-zh-hant',
    label: 'Wikidata organizations (zh-hant)',
    source: 'wikidata',
    relativePath: 'wikidata/org-zh-hant/orgs.ndjson',
    defaultTag: 'orgName',
  },
  {
    id: 'wikidata-orgs-ja',
    label: 'Wikidata organizations (ja)',
    source: 'wikidata',
    relativePath: 'wikidata/org-ja/orgs.ndjson',
    defaultTag: 'orgName',
  },
  {
    id: 'wikidata-orgs-bo',
    label: 'Wikidata organizations (bo)',
    source: 'wikidata',
    relativePath: 'wikidata/org-bo/orgs.ndjson',
    defaultTag: 'orgName',
  },
  {
    id: 'wikidata-works-zh-hant',
    label: 'Wikidata works (zh-hant)',
    source: 'wikidata',
    relativePath: 'wikidata/work-zh-hant/works.ndjson',
    defaultTag: 'title',
  },
  {
    id: 'wikidata-works-ja',
    label: 'Wikidata works (ja)',
    source: 'wikidata',
    relativePath: 'wikidata/work-ja/works.ndjson',
    defaultTag: 'title',
  },
  {
    id: 'ndl-persons',
    label: 'NDL persons',
    source: 'ndl',
    relativePath: 'ndl/persons.ndjson',
    defaultTag: 'persName',
  },
  {
    id: 'ndl-places',
    label: 'NDL places',
    source: 'ndl',
    relativePath: 'ndl/places.ndjson',
    defaultTag: 'placeName',
  },
  {
    id: 'ndl-orgs',
    label: 'NDL organizations',
    source: 'ndl',
    relativePath: 'ndl/orgs.ndjson',
    defaultTag: 'orgName',
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
  if (spec.virtual) {
    throw new Error(`Pack ${packId} is a UI grouping — expand with expandAuthorityPackIds() first`);
  }
  const sep = baseFolder.includes('\\') ? '\\' : '/';
  return `${baseFolder.replace(/[/\\]+$/, '')}${sep}${AUTHORITY_PACKS_DIRNAME}${sep}${spec.relativePath.replace(/\//g, sep)}`;
}

/** Pack ids shown in the auto-tagging authority dialog (one Wikidata row, not per-dynasty). */
export const UI_AUTHORITY_PACK_IDS: AuthorityPackId[] = [
  'cbdb-persons',
  'cbdb-places',
  'cbdb-offices',
  'dila-persons',
  'dila-places',
  'chgis-places',
  'wikidata-persons',
  'wikidata-persons-ja',
  'wikidata-persons-bo',
  'wikidata-places-bo',
  'wikidata-orgs-zh-hant',
  'wikidata-orgs-ja',
  'wikidata-orgs-bo',
  'wikidata-works-zh-hant',
  'wikidata-works-ja',
  'ndl-persons',
  'ndl-places',
  'ndl-orgs',
  'ndl-works',
];

/** Expand virtual selections (e.g. `wikidata-persons` → all installed dynasty packs). */
export function expandAuthorityPackIds(packIds: AuthorityPackId[]): AuthorityPackId[] {
  const out: AuthorityPackId[] = [];
  for (const id of packIds) {
    if (id === 'wikidata-persons') out.push(...WIKIDATA_PERSON_CHILD_PACK_IDS);
    else out.push(id);
  }
  return [...new Set(out)];
}

export function isWikidataPersonChildPackId(id: AuthorityPackId): boolean {
  return WIKIDATA_PERSON_CHILD_SET.has(id);
}

/** Map persisted pack ids (incl. legacy per-dynasty Wikidata) to UI checkbox state. */
export function uiPacksFromPersisted(persisted?: AuthorityPackId[]): Record<AuthorityPackId, boolean> {
  const base = Object.fromEntries(UI_AUTHORITY_PACK_IDS.map((id) => [id, false])) as Record<
    AuthorityPackId,
    boolean
  >;
  if (!persisted?.length) return base;
  for (const id of UI_AUTHORITY_PACK_IDS) {
    if (id === 'wikidata-persons') continue;
    base[id] = persisted.includes(id);
  }
  base['wikidata-persons'] =
    persisted.includes('wikidata-persons') ||
    WIKIDATA_PERSON_CHILD_PACK_IDS.some((id) => persisted.includes(id));
  return base;
}

/** Persist UI checkbox state (stores `wikidata-persons`, not dynasty child ids). */
export function persistedPacksFromUi(packs: Record<AuthorityPackId, boolean>): AuthorityPackId[] {
  return UI_AUTHORITY_PACK_IDS.filter((id) => packs[id]);
}

export function packsRoot(baseFolder: string): string {
  const sep = baseFolder.includes('\\') ? '\\' : '/';
  return `${baseFolder.replace(/[/\\]+$/, '')}${sep}${AUTHORITY_PACKS_DIRNAME}`;
}

/** Display order for authority pack checkboxes (grouped by entity type, not source). */
export const AUTHORITY_TAG_TYPE_GROUP_ORDER = [
  'persName',
  'placeName',
  'orgName',
  'roleName',
  'title',
] as const;

export const AUTHORITY_TAG_TYPE_GROUP_LABELS: Record<
  (typeof AUTHORITY_TAG_TYPE_GROUP_ORDER)[number],
  string
> = {
  persName: 'Persons',
  placeName: 'Places',
  orgName: 'Organizations',
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

export const AUTHORITY_SOURCE_ORDER = ['cbdb', 'dila', 'chgis', 'wikidata', 'ndl'] as const;

export type AuthoritySourceId = (typeof AUTHORITY_SOURCE_ORDER)[number];

export const AUTHORITY_SOURCE_LABELS: Record<AuthoritySourceId, string> = {
  cbdb: 'CBDB',
  dila: 'DILA',
  chgis: 'CHGIS',
  wikidata: 'Wikidata',
  ndl: 'NDL',
};

/** Short row label under a source heading (Persons, Places, …). */
export const AUTHORITY_PACK_SHORT_LABELS: Partial<Record<AuthorityPackId, string>> = {
  'cbdb-persons': 'Persons',
  'cbdb-places': 'Places',
  'cbdb-offices': 'Offices',
  'dila-persons': 'Persons',
  'dila-places': 'Places',
  'chgis-places': 'Places',
  'wikidata-persons': 'Persons',
  'wikidata-persons-ja': 'Persons (ja)',
  'wikidata-persons-bo': 'Persons (bo)',
  'wikidata-places-bo': 'Places (bo)',
  'wikidata-orgs-zh-hant': 'Organizations (zh-hant)',
  'wikidata-orgs-ja': 'Organizations (ja)',
  'wikidata-orgs-bo': 'Organizations (bo)',
  'wikidata-works-zh-hant': 'Works (zh-hant)',
  'wikidata-works-ja': 'Works (ja)',
  'ndl-persons': 'Persons',
  'ndl-places': 'Places',
  'ndl-orgs': 'Organizations',
  'ndl-works': 'Works',
};

export interface AuthorityPackSourceGroup {
  source: AuthoritySourceId;
  label: string;
  packs: AuthorityPackSpec[];
}

/** Group visible pack specs by authority source (CBDB, DILA, …). */
export function groupAuthorityPacksBySource(packIds: AuthorityPackId[]): AuthorityPackSourceGroup[] {
  const specs = packIds
    .map((id) => AUTHORITY_PACKS.find((p) => p.id === id))
    .filter((p): p is AuthorityPackSpec => !!p);
  const groups: AuthorityPackSourceGroup[] = [];
  for (const source of AUTHORITY_SOURCE_ORDER) {
    const packs = specs.filter((p) => p.source === source);
    if (packs.length > 0) {
      groups.push({ source, label: AUTHORITY_SOURCE_LABELS[source], packs });
    }
  }
  return groups;
}

export function shortAuthorityPackLabel(packId: AuthorityPackId): string {
  return AUTHORITY_PACK_SHORT_LABELS[packId] ?? AUTHORITY_PACKS.find((p) => p.id === packId)?.label ?? packId;
}
