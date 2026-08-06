import { mintOrLinkEntitySqlite } from './sqliteLookupMint';
import type { EntityStore } from './entityStore';
import type { SqlitePanelSummaryLike } from './sqliteSummary';

type Panel = SqlitePanelSummaryLike;

const panel = (over: Partial<Panel> & Pick<Panel, 'id' | 'kind'>): Panel => ({
  description: null,
  names: [
    {
      text: over.names?.[0]?.text ?? '禹',
      nameType: 'primary',
      language: null,
      status: 'active',
    },
  ],
  authorities: [],
  familyName: null,
  givenName: null,
  startYear: null,
  endYear: null,
  workDate: null,
  nationalities: [],
  placesOfOrigin: [],
  roles: [],
  origins: [],
  authors: [],
  nobleTitles: [],
  assertions: [],
  ...over,
});

const makeStore = (seed: Panel[] = []) => {
  const entities = new Map(seed.map((row) => [row.id, structuredClone(row)]));
  const nationalities: Array<{ entityId: string; label: string; ref?: string; source?: string }> =
    [];

  const g = globalThis as { window?: { electronAPI?: Record<string, unknown> } };
  g.window = g.window ?? { electronAPI: {} };
  g.window.electronAPI = {
    ...(g.window.electronAPI ?? {}),
    entitySqliteCreatePopulated: async () => ({}),
    entitySqliteAttachAuthority: async () => true,
  };

  const store = {
    hasSqliteDatabase: async () => true,
    sqliteEntitySummary: async (entityId: string) => entities.get(entityId) ?? null,
    sqliteFindByAuthority: async (
      kind: string,
      type: string,
      value: string,
    ): Promise<string | null> => {
      for (const row of entities.values()) {
        if (row.kind !== kind) continue;
        if (row.authorities.some((a) => a.type === type && a.value === value)) return row.id;
      }
      return null;
    },
    sqliteCreatePopulated: async (input: {
      id: string;
      kind: Panel['kind'];
      description?: string | null;
      names?: Array<{
        text: string;
        nameType?: string | null;
        language?: string | null;
        isPrimary?: boolean;
      }>;
      authorities?: Array<{ type: string; value: string; origin?: string }>;
      familyName?: string | null;
      givenName?: string | null;
    }) => {
      entities.set(
        input.id,
        panel({
          id: input.id,
          kind: input.kind,
          description: input.description ?? null,
          names: (input.names ?? []).map((name) => ({
            text: name.text,
            nameType: name.nameType ?? null,
            language: name.language ?? null,
            status: 'active' as const,
          })),
          authorities: (input.authorities ?? []).map((a) => ({
            type: a.type,
            value: a.value,
            ...(a.origin ? { origin: a.origin } : {}),
          })) as Panel['authorities'],
          familyName: input.familyName ?? null,
          givenName: input.givenName ?? null,
        }),
      );
      return {};
    },
    sqliteAttachAuthority: async (entityId: string, type: string, value: string) => {
      const row = entities.get(entityId);
      if (!row) return false;
      if (row.authorities.some((a) => a.type === type && a.value === value)) return false;
      row.authorities.push({ type, value });
      return true;
    },
    sqliteApplyAuthorityBackfillPatch: async (input: {
      entityId: string;
      dates?: Array<{ source: string; startYear?: number | null; endYear?: number | null }>;
      nationalities?: Array<{ label: string; ref?: string | null; source: string }>;
      origins?: Array<{ label: string; ref?: string | null; source: string }>;
    }) => {
      const row = entities.get(input.entityId);
      if (!row) return { changed: false, namesAdded: 0 };
      for (const date of input.dates ?? []) {
        if (date.startYear != null) row.startYear = date.startYear;
        if (date.endYear != null) row.endYear = date.endYear;
      }
      for (const nationality of input.nationalities ?? []) {
        nationalities.push({
          entityId: input.entityId,
          label: nationality.label,
          ...(nationality.ref ? { ref: nationality.ref } : {}),
          ...(nationality.source ? { source: nationality.source } : {}),
        });
      }
      return { changed: true, namesAdded: 0 };
    },
    sqliteSetUserDate: async (input: {
      entityId: string;
      part: 'birth' | 'death';
      year: number | null;
    }) => {
      const row = entities.get(input.entityId);
      if (!row) return;
      if (input.part === 'birth') row.startYear = input.year;
      if (input.part === 'death') row.endYear = input.year;
    },
    sqliteSetUserWorkDate: async (input: {
      entityId: string;
      startYear: number | null;
      endYear: number | null;
    }) => {
      const row = entities.get(input.entityId);
      if (!row) return;
      row.startYear = input.startYear;
      row.endYear = input.endYear;
    },
    sqliteAddNationality: async (input: {
      entityId: string;
      label: string;
      ref?: string | null;
      source?: string | null;
    }) => {
      nationalities.push({
        entityId: input.entityId,
        label: input.label,
        ...(input.ref ? { ref: input.ref } : {}),
        ...(input.source ? { source: input.source } : {}),
      });
      return true;
    },
    sqliteAddOrigin: async () => true,
    sqliteSetRomanizedName: async (entityId: string, text: string, language?: string | null) => {
      const row = entities.get(entityId);
      if (!row) return;
      if (row.names.some((n) => n.text === text)) return;
      row.names.push({
        text,
        nameType: 'variant',
        language: language ?? 'und-Latn',
        status: 'active',
      });
    },
    sqliteAddName: async (input: {
      entityId: string;
      text: string;
      nameType?: string | null;
      language?: string | null;
    }) => {
      const row = entities.get(input.entityId);
      if (!row) return false;
      row.names.push({
        text: input.text,
        nameType: input.nameType ?? null,
        language: input.language ?? null,
        status: 'active',
      });
      if (input.nameType === 'family') row.familyName = input.text;
      if (input.nameType === 'given') row.givenName = input.text;
      return true;
    },
  };

  return { store: store as unknown as EntityStore, entities, nationalities };
};

describe('mintOrLinkEntitySqlite', () => {
  it('mints with a description', async () => {
    const { store, entities } = makeStore();
    const result = await mintOrLinkEntitySqlite(store, {
      kind: 'person',
      name: '禹',
      description: 'legendary flood-taming ruler, founder of the Xia dynasty',
    });
    expect(result.created).toBe(true);
    expect(entities.get(result.id)?.description).toBe(
      'legendary flood-taming ruler, founder of the Xia dynasty',
    );
  });

  it('mints with life dates', async () => {
    const { store, entities } = makeStore();
    const result = await mintOrLinkEntitySqlite(store, {
      kind: 'person',
      name: '張衡',
      description: '(78–139) Han dynasty polymath',
      startYear: 78,
      endYear: 139,
    });
    expect(result.created).toBe(true);
    expect(entities.get(result.id)?.startYear).toBe(78);
    expect(entities.get(result.id)?.endYear).toBe(139);
  });

  it('stores work years via sqliteSetUserWorkDate', async () => {
    const { store, entities } = makeStore();
    const result = await mintOrLinkEntitySqlite(store, {
      kind: 'work',
      name: '南史',
      startYear: 480,
      endYear: 502,
    });
    expect(result.created).toBe(true);
    expect(entities.get(result.id)?.startYear).toBe(480);
    expect(entities.get(result.id)?.endYear).toBe(502);
  });

  it('writes per-source nationalities from authorityAssertions', async () => {
    const { store, nationalities } = makeStore();
    const result = await mintOrLinkEntitySqlite(store, {
      kind: 'person',
      name: '劉善明',
      authorityAssertions: [
        {
          source: 'DILA',
          startYear: 420,
          nationality: [{ canonicalId: 'dynasty:song-liu', label: '宋(劉)' }],
        },
        {
          source: 'WIKIDATA',
          startYear: 425,
          nationality: [{ canonicalId: 'dynasty:song-liu', label: '宋(劉)' }],
        },
      ],
    });
    expect(result.created).toBe(true);
    expect(nationalities.map((row) => row.source).sort()).toEqual(['DILA', 'WIKIDATA']);
  });

  it('reuses an authority match and attaches additional authorities', async () => {
    const { store, entities } = makeStore([
      panel({
        id: 'person-existing',
        kind: 'person',
        names: [{ text: '劉善明', nameType: 'primary', language: null, status: 'active' }],
        authorities: [{ type: 'DILA', value: 'A003126' }],
      }),
    ]);

    const result = await mintOrLinkEntitySqlite(store, {
      kind: 'person',
      name: '劉善明',
      authorityIds: [
        { type: 'DILA', value: 'A003126' },
        { type: 'Wikidata', value: 'Q1' },
      ],
      authorityAssertions: [{ source: 'WIKIDATA', startYear: 425 }],
    });
    expect(result).toEqual({ id: 'person-existing', created: false });
    expect(entities.get('person-existing')?.authorities).toEqual(
      expect.arrayContaining([
        { type: 'DILA', value: 'A003126' },
        { type: 'Wikidata', value: 'Q1' },
      ]),
    );
    expect(entities.get('person-existing')?.startYear).toBe(425);
  });

  it('reuses by localEntityId when present', async () => {
    const { store, entities } = makeStore([
      panel({
        id: 'person-local',
        kind: 'person',
        names: [{ text: '王安石', nameType: 'primary', language: null, status: 'active' }],
      }),
    ]);

    const result = await mintOrLinkEntitySqlite(store, {
      kind: 'person',
      name: '王安石',
      localEntityId: 'person-local',
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });
    expect(result).toEqual({ id: 'person-local', created: false });
    expect(entities.size).toBe(1);
    expect(entities.get('person-local')?.authorities).toEqual([{ type: 'CBDB', value: '1762' }]);
  });

  it('mints with romanized name as a Latn variant', async () => {
    const { store, entities } = makeStore();
    const result = await mintOrLinkEntitySqlite(store, {
      kind: 'person',
      name: '張衡',
      romanizedName: 'Zhang Heng',
      nameLang: 'zh-Hant',
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });
    expect(entities.get(result.id)?.names).toEqual([
      { text: '張衡', nameType: 'primary', language: 'zh-Hant', status: 'active' },
      { text: 'Zhang Heng', nameType: 'variant', language: 'zh-Hant-Latn', status: 'active' },
    ]);
  });
});
