import { promoteToCentralSqlite } from './sqliteBridgeOps';
import type { EntityStore } from './entityStore';
import type { SqlitePanelSummaryLike } from './sqliteSummary';

type Panel = SqlitePanelSummaryLike;

const panel = (over: Partial<Panel> & Pick<Panel, 'id' | 'kind'>): Panel => ({
  description: null,
  names: [
    {
      text: '張衡',
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
  /** `${userStableId}\0${pedbId}` → centralId */
  const byPedb = new Map<string, string>();

  const store = {
    sqliteEntitySummary: async (entityId: string) => entities.get(entityId) ?? null,
    sqliteGetCentralId: async (pedbId: string, userStableId: string) =>
      byPedb.get(`${userStableId}\0${pedbId}`) ?? null,
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
    sqliteFindByNameDates: async (
      kind: string,
      name: string,
      start: number | null | undefined,
      end: number | null | undefined,
    ): Promise<string | null> => {
      const hits = [...entities.values()].filter((row) => {
        if (row.kind !== kind) return false;
        if (!row.names.some((n) => n.status === 'active' && n.text === name)) return false;
        if (start != null && row.startYear != null && row.startYear !== start) return false;
        if (end != null && row.endYear != null && row.endYear !== end) return false;
        return true;
      });
      return hits.length === 1 ? hits[0]!.id : null;
    },
    sqliteCreatePopulated: async (input: {
      id: string;
      kind: Panel['kind'];
      description?: string | null;
      names?: { text: string; nameType?: string | null; language?: string | null }[];
      authorities?: { type: string; value: string; origin?: string }[];
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
          startYear: null,
          endYear: null,
        }),
      );
      return {};
    },
    sqliteSetCentralMapping: async (pedbId: string, userStableId: string, centralId: string) => {
      const key = `${userStableId}\0${pedbId}`;
      const previous = byPedb.get(key);
      byPedb.set(key, centralId);
      return previous !== centralId;
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
    sqliteSetUserWorkDate: async () => undefined,
  };

  return { store: store as unknown as EntityStore, entities, byPedb };
};

const USER = 'user-a';

describe('promoteToCentralSqlite', () => {
  it('mints a central record and links when there is no match', async () => {
    const project = makeStore([
      panel({
        id: 'person-pedb-1',
        kind: 'person',
        description: 'Han polymath',
        names: [
          { text: '張衡', nameType: 'primary', language: null, status: 'active' },
          { text: '平子', nameType: 'courtesy', language: null, status: 'active' },
        ],
        authorities: [{ type: 'CBDB', value: '1762' }],
        startYear: 78,
      }),
    ]);
    const central = makeStore();

    const result = await promoteToCentralSqlite(
      project.store,
      central.store,
      'person-pedb-1',
      USER,
    );
    expect(result).toMatchObject({ created: true, linked: true });
    expect(result?.centralId).toMatch(/^person-/);
    expect(project.byPedb.get(`${USER}\0person-pedb-1`)).toBe(result?.centralId);

    const minted = central.entities.get(result!.centralId)!;
    expect(minted.names.map((n) => n.text).sort()).toEqual(['平子', '張衡']);
    expect(minted.description).toBe('Han polymath');
    expect(minted.startYear).toBe(78);
    expect(minted.authorities).toEqual([{ type: 'CBDB', value: '1762', origin: 'xml' }]);
  });

  it('links to an existing central record that shares an authority id', async () => {
    const central = makeStore([
      panel({
        id: 'person-central-1',
        kind: 'person',
        authorities: [{ type: 'CBDB', value: '1762' }],
      }),
    ]);
    const project = makeStore([
      panel({
        id: 'person-pedb-1',
        kind: 'person',
        names: [{ text: '張平子', nameType: 'primary', language: null, status: 'active' }],
        authorities: [{ type: 'CBDB', value: '1762' }],
      }),
    ]);

    const result = await promoteToCentralSqlite(
      project.store,
      central.store,
      'person-pedb-1',
      USER,
    );
    expect(result).toEqual({ centralId: 'person-central-1', created: false, linked: true });
    expect(central.entities.size).toBe(1);
  });

  it('is idempotent when already mapped', async () => {
    const project = makeStore([
      panel({
        id: 'person-pedb-1',
        kind: 'person',
        authorities: [{ type: 'CBDB', value: '1' }],
      }),
    ]);
    const central = makeStore();

    const first = await promoteToCentralSqlite(
      project.store,
      central.store,
      'person-pedb-1',
      USER,
    );
    const second = await promoteToCentralSqlite(
      project.store,
      central.store,
      'person-pedb-1',
      USER,
    );
    expect(second).toEqual({
      centralId: first!.centralId,
      created: false,
      linked: false,
    });
    expect(central.entities.size).toBe(1);
  });

  it('keeps separate mappings per user', async () => {
    const project = makeStore([panel({ id: 'person-pedb-1', kind: 'person' })]);
    const central = makeStore();

    const a = await promoteToCentralSqlite(project.store, central.store, 'person-pedb-1', 'user-a');
    const b = await promoteToCentralSqlite(project.store, central.store, 'person-pedb-1', 'user-b');
    expect(project.byPedb.get('user-a\0person-pedb-1')).toBe(a?.centralId);
    expect(project.byPedb.get('user-b\0person-pedb-1')).toBe(b?.centralId);
  });

  it('links to a name+dates match when there is no shared authority id', async () => {
    const central = makeStore([
      panel({
        id: 'person-central-1',
        kind: 'person',
        startYear: 78,
        endYear: 139,
      }),
    ]);
    const project = makeStore([
      panel({
        id: 'person-pedb-1',
        kind: 'person',
        startYear: 78,
        endYear: 139,
      }),
    ]);

    const result = await promoteToCentralSqlite(
      project.store,
      central.store,
      'person-pedb-1',
      USER,
    );
    expect(result).toEqual({ centralId: 'person-central-1', created: false, linked: true });
    expect(central.entities.size).toBe(1);
  });

  it('prefers an authority match over a name+dates match when both would apply', async () => {
    const central = makeStore([
      panel({
        id: 'person-by-authority',
        kind: 'person',
        startYear: 78,
        endYear: 139,
        authorities: [{ type: 'CBDB', value: '1762' }],
      }),
      panel({
        id: 'person-decoy',
        kind: 'person',
        startYear: 78,
        endYear: 139,
      }),
    ]);
    const project = makeStore([
      panel({
        id: 'person-pedb-1',
        kind: 'person',
        startYear: 78,
        endYear: 139,
        authorities: [{ type: 'CBDB', value: '1762' }],
      }),
    ]);

    const result = await promoteToCentralSqlite(
      project.store,
      central.store,
      'person-pedb-1',
      USER,
    );
    expect(result?.centralId).toBe('person-by-authority');
    expect(central.entities.size).toBe(2);
  });

  it('mints a new central record when the name+dates fallback is ambiguous', async () => {
    const central = makeStore([
      panel({ id: 'person-a', kind: 'person' }),
      panel({ id: 'person-b', kind: 'person' }),
    ]);
    const project = makeStore([panel({ id: 'person-pedb-1', kind: 'person' })]);

    const result = await promoteToCentralSqlite(
      project.store,
      central.store,
      'person-pedb-1',
      USER,
    );
    expect(result?.created).toBe(true);
    expect(central.entities.size).toBe(3);
  });

  it('returns null when the project entity is missing', async () => {
    const result = await promoteToCentralSqlite(
      makeStore().store,
      makeStore().store,
      'person-missing',
      USER,
    );
    expect(result).toBeNull();
  });
});
