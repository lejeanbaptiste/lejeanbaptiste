import { adoptFromCentralSqlite } from './sqliteBridgeOps';
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
  authorities: [{ type: 'CBDB', value: '1762' }],
  familyName: null,
  givenName: null,
  startYear: 78,
  endYear: 139,
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
  const byCentral = new Map<string, string>(); // `${user}\0${centralId}` -> pedbId

  const store = {
    sqliteEntitySummary: async (entityId: string) => entities.get(entityId) ?? null,
    sqliteListMappingsByCentralIds: async (userStableId: string, centralIds: string[]) =>
      centralIds
        .map((centralId) => {
          const projectEntityId = byCentral.get(`${userStableId}\0${centralId}`);
          return projectEntityId ? { projectEntityId, centralId } : null;
        })
        .filter((row): row is { projectEntityId: string; centralId: string } => Boolean(row)),
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
      _start: number | null | undefined,
      _end: number | null | undefined,
    ): Promise<string | null> => {
      const hits = [...entities.values()].filter(
        (row) =>
          row.kind === kind && row.names.some((n) => n.status === 'active' && n.text === name),
      );
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
      byCentral.set(`${userStableId}\0${centralId}`, pedbId);
      return true;
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

  return { store: store as unknown as EntityStore, entities, byCentral };
};

const USER = 'user-a';

describe('adoptFromCentralSqlite', () => {
  it('mints a PEDB mirror and maps it to the central id', async () => {
    const central = makeStore([panel({ id: 'person-central-1', kind: 'person' })]);
    const project = makeStore();

    const result = await adoptFromCentralSqlite(
      project.store,
      central.store,
      'person-central-1',
      USER,
    );
    expect(result).toMatchObject({ created: true });
    expect(result?.pedbId).toMatch(/^person-/);
    expect(project.byCentral.get(`${USER}\0person-central-1`)).toBe(result?.pedbId);
    expect(project.entities.get(result!.pedbId)?.authorities).toEqual([
      { type: 'CBDB', value: '1762', origin: 'xml' },
    ]);
    expect(project.entities.get(result!.pedbId)?.startYear).toBe(78);
    expect(project.entities.get(result!.pedbId)?.endYear).toBe(139);
  });

  it('reuses an existing mapping without minting again', async () => {
    const central = makeStore([panel({ id: 'person-central-1', kind: 'person' })]);
    const project = makeStore([
      panel({
        id: 'person-pedb-1',
        kind: 'person',
        authorities: [],
        startYear: null,
        endYear: null,
      }),
    ]);
    project.byCentral.set(`${USER}\0person-central-1`, 'person-pedb-1');

    const result = await adoptFromCentralSqlite(
      project.store,
      central.store,
      'person-central-1',
      USER,
    );
    expect(result).toEqual({ pedbId: 'person-pedb-1', created: false });
    expect(project.entities.size).toBe(1);
  });

  it('links an authority match instead of minting a duplicate', async () => {
    const central = makeStore([panel({ id: 'person-central-1', kind: 'person' })]);
    const project = makeStore([
      panel({
        id: 'person-pedb-existing',
        kind: 'person',
        authorities: [{ type: 'CBDB', value: '1762' }],
        startYear: null,
        endYear: null,
      }),
    ]);

    const result = await adoptFromCentralSqlite(
      project.store,
      central.store,
      'person-central-1',
      USER,
    );
    expect(result).toEqual({ pedbId: 'person-pedb-existing', created: false });
    expect(project.byCentral.get(`${USER}\0person-central-1`)).toBe('person-pedb-existing');
    expect(project.entities.size).toBe(1);
  });

  it('returns null when the central entity is missing', async () => {
    const result = await adoptFromCentralSqlite(
      makeStore().store,
      makeStore().store,
      'person-missing',
      USER,
    );
    expect(result).toBeNull();
  });
});
