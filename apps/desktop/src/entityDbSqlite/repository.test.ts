import { EntitySqliteRepository } from './repository';
import { computeEntityContentHash, replaceEntityContentBetween } from './xmlCodec';

describe('EntitySqliteRepository', () => {
  it('creates subtype records and returns typed summaries', () => {
    const repository = new EntitySqliteRepository();
    const entity = repository.createEntity({ id: 'person-test-1', kind: 'person' });

    expect(entity.kind).toBe('person');
    expect(
      repository.db.prepare('SELECT 1 FROM people WHERE entity_id = ?').get(entity.id),
    ).toEqual({ 1: 1 });
    expect(repository.integrityCheck()).toEqual(['ok']);
    repository.close();
  });

  it('searches active names without scanning the XML document', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-search-1', kind: 'person', description: 'A person' });
    repository.addName({
      entityId: 'person-search-1',
      text: '孔遺',
      isPrimary: true,
      origin: 'xml',
      source: 'legacy-xml',
    });
    repository.db
      .prepare(
        `INSERT INTO entity_authorities
        (entity_id, authority_type, authority_value, origin, source, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'person-search-1',
        'Wikidata',
        'Q1',
        'authority',
        'Wikidata',
        'active',
        '2026-01-01',
        '2026-01-01',
      );

    expect(repository.searchNames('person', '  孔遺 ')).toEqual([
      expect.objectContaining({
        id: 'person-search-1',
        label: '孔遺',
        description: 'A person',
        idnos: [{ type: 'Wikidata', value: 'Q1' }],
      }),
    ]);
    expect(repository.searchNames('place', '孔遺')).toEqual([]);
    repository.close();
  });

  it('normalizes VIAF/Wikidata URIs when attaching authorities', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-auth-1', kind: 'person' });
    expect(
      repository.attachAuthority({
        entityId: 'person-auth-1',
        type: 'viaf',
        value: 'http://viaf.org/viaf/68484316',
      }),
    ).toBe(true);
    expect(repository.getPanelSummary('person-auth-1')?.authorities).toEqual([
      { type: 'VIAF', value: '68484316' },
    ]);
    expect(
      repository.attachAuthority({
        entityId: 'person-auth-1',
        type: 'VIAF',
        value: '68484316',
      }),
    ).toBe(false);
    expect(
      repository.attachAuthority({
        entityId: 'person-auth-1',
        type: 'wikidata',
        value: 'http://www.wikidata.org/entity/Q42',
      }),
    ).toBe(true);
    expect(repository.getPanelSummary('person-auth-1')?.authorities).toEqual(
      expect.arrayContaining([
        { type: 'VIAF', value: '68484316' },
        { type: 'Wikidata', value: 'Q42' },
      ]),
    );
    repository.close();
  });

  it('updates one name transactionally and preserves a tombstone', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({
      id: 'person-test-2',
      kind: 'person',
      now: '2026-01-01T00:00:00.000Z',
    });
    const name = repository.addName({
      entityId: 'person-test-2',
      text: '孔遺',
      isPrimary: true,
      origin: 'xml',
      source: 'legacy-xml',
      now: '2026-01-01T00:00:01.000Z',
    });

    expect(repository.getSummary('person-test-2')?.names).toHaveLength(1);
    repository.tombstoneName(name.id, 'user-deleted', '2026-01-01T00:00:02.000Z');

    expect(repository.listNames('person-test-2')).toEqual([]);
    expect(repository.listNames('person-test-2', true)[0]).toMatchObject({
      text: '孔遺',
      status: 'withdrawn',
      origin: 'xml',
    });
    expect(
      repository.db
        .prepare('SELECT reason FROM entity_tombstones WHERE table_name = ? AND row_id = ?')
        .get('entity_names', name.id),
    ).toEqual({ reason: 'user-deleted' });
    expect(repository.getEntity('person-test-2')?.revision).toBe(2);
    repository.close();
  });

  it('updates and tombstones all active assertions for a displayed name', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-name-ops', kind: 'person' });
    repository.addName({
      entityId: 'person-name-ops',
      text: '孔遺',
      nameType: 'courtesy',
      isPrimary: true,
    });
    repository.addName({
      entityId: 'person-name-ops',
      text: '孔遺',
      origin: 'authority',
      source: 'Wikidata',
    });

    expect(
      repository.updateNamesByText({
        entityId: 'person-name-ops',
        text: '孔遺',
        nameType: 'variant',
        language: 'zh-Hant',
      }),
    ).toBe(2);
    expect(repository.listNames('person-name-ops')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nameType: 'variant', language: 'zh-Hant' }),
      ]),
    );

    expect(repository.tombstoneNamesByText('person-name-ops', '孔遺')).toBe(2);
    expect(repository.listNames('person-name-ops')).toEqual([]);
    expect(
      repository.db
        .prepare(
          "SELECT COUNT(*) AS count FROM entity_tombstones WHERE entity_id = ? AND table_name = 'entity_names'",
        )
        .get('person-name-ops'),
    ).toEqual({ count: 2 });
    repository.close();
  });

  it('removes user names and rejects authority names while promoting a survivor', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-remove-name', kind: 'person' });
    repository.addName({ entityId: 'person-remove-name', text: 'Primary', isPrimary: true });
    const authorityName = repository.addName({
      entityId: 'person-remove-name',
      text: 'Authority variant',
      origin: 'authority',
      source: 'Wikidata',
    });

    expect(repository.removeNameByText('person-remove-name', 'Authority variant')).toBe(true);
    expect(repository.listNames('person-remove-name')).toEqual([
      expect.objectContaining({ text: 'Primary', isPrimary: true }),
    ]);
    expect(repository.listNames('person-remove-name', true)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: authorityName.id, status: 'rejected' }),
      ]),
    );
    repository.close();
  });

  it('returns a panel snapshot with fields and provenance-bearing assertions', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-panel-1', kind: 'person', description: 'A scholar' });
    repository.addName({ entityId: 'person-panel-1', text: '孔遺', isPrimary: true });
    repository.db
      .prepare(
        `INSERT INTO entity_authorities
          (entity_id, authority_type, authority_value, origin, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'person-panel-1',
        'Wikidata',
        'Q1',
        'authority',
        'Wikidata',
        'active',
        '2026-01-01',
        '2026-01-01',
      );
    repository.db
      .prepare(
        `INSERT INTO entity_dates
          (entity_id, date_kind, start_year, origin, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'person-panel-1',
        'birth',
        479,
        'authority',
        'Norbert',
        'active',
        '2026-01-01',
        '2026-01-01',
      );

    const snapshot = repository.getPanelSummary('person-panel-1')!;
    expect(snapshot).toMatchObject({
      description: 'A scholar',
      authorities: [{ type: 'Wikidata', value: 'Q1' }],
      startYear: 479,
      assertions: expect.arrayContaining([
        expect.objectContaining({ element: 'idno', value: 'Q1', source: 'Wikidata' }),
        expect.objectContaining({ element: 'birth', value: '479', source: 'Norbert' }),
        expect.objectContaining({ element: 'note', noteType: 'description', value: 'A scholar' }),
      ]),
    });
    expect(repository.listPanelSummaries()).toEqual([snapshot]);
    repository.close();
  });

  it('reads the database UUID from SQLite metadata without XML export', () => {
    const repository = new EntitySqliteRepository();
    repository.db
      .prepare('INSERT INTO database_metadata (key, value) VALUES (?, ?)')
      .run('database_id', 'db-test-uuid');
    expect(repository.getDatabaseId()).toBe('db-test-uuid');
    repository.close();
  });

  it('includes noble titles and work authors in the panel snapshot', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-title-1', kind: 'person' });
    repository.db
      .prepare(
        `INSERT INTO person_titles
          (person_id, dynasty, place_name, role_name, posthumous_name, reference, origin, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'person-title-1',
        '宋',
        '荊國',
        '公',
        '文忠',
        'T1',
        'authority',
        'Norbert',
        'active',
        '2026-01-01',
        '2026-01-01',
      );
    repository.createEntity({ id: 'work-author-1', kind: 'work' });
    repository.db
      .prepare(
        `INSERT INTO work_authors
          (work_id, label, reference, origin, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'work-author-1',
        '孔遺',
        'person-title-1',
        'authority',
        'CBDB',
        'active',
        '2026-01-01',
        '2026-01-01',
      );

    expect(repository.getPanelSummary('person-title-1')?.nobleTitles).toEqual([
      expect.objectContaining({ dynasty: '宋', fief: '荊國', title: '公' }),
    ]);
    expect(repository.getPanelSummary('work-author-1')?.authors).toEqual([
      expect.objectContaining({ name: '孔遺', ref: 'person-title-1' }),
    ]);
    expect(repository.getPanelSummary('person-title-1')?.assertions).toEqual(
      expect.arrayContaining([expect.objectContaining({ element: 'nobleTitle', value: '公' })]),
    );
    expect(repository.getPanelSummary('work-author-1')?.assertions).toEqual(
      expect.arrayContaining([expect.objectContaining({ element: 'author', value: '孔遺' })]),
    );
    repository.close();
  });

  it('detects duplicate active authority identifiers from SQLite', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-dup-1', kind: 'person' });
    repository.createEntity({ id: 'person-dup-2', kind: 'person' });
    for (const id of ['person-dup-1', 'person-dup-2']) {
      repository.db
        .prepare(
          `INSERT INTO entity_authorities
            (entity_id, authority_type, authority_value, origin, source, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          'Wikidata',
          'https://www.wikidata.org/entity/Q42',
          'authority',
          'Wikidata',
          'active',
          '2026-01-01',
          '2026-01-01',
        );
    }
    expect(repository.listAuthorityDuplicates()).toEqual([
      { type: 'Wikidata', value: 'Q42', entityIds: ['person-dup-1', 'person-dup-2'] },
    ]);
    repository.db
      .prepare(
        `INSERT INTO entity_decisions
          (entity_id, decision_type, target_refs, origin, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('person-dup-1', 'duplicate-ok', '#person-dup-1 #person-dup-2', 'user', '2026-01-01');
    expect(repository.listAuthorityDuplicates()).toEqual([]);
    repository.close();
  });

  it('marks intentional duplicate groups and backfills missing target_refs from XML notes', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-dup-a', kind: 'person' });
    repository.createEntity({ id: 'person-dup-b', kind: 'person' });
    for (const id of ['person-dup-a', 'person-dup-b']) {
      repository.attachAuthority({
        entityId: id,
        type: 'Wikidata',
        value: 'Q99',
        origin: 'authority',
        source: 'Wikidata',
      });
    }
    expect(repository.listAuthorityDuplicates()).toEqual([
      { type: 'Wikidata', value: 'Q99', entityIds: ['person-dup-a', 'person-dup-b'] },
    ]);
    expect(repository.markDuplicateIntentional(['person-dup-a', 'person-dup-b'])).toBe(true);
    expect(repository.listAuthorityDuplicates()).toEqual([]);

    const broken = new EntitySqliteRepository();
    broken.createEntity({ id: 'person-old-1', kind: 'person' });
    broken.createEntity({ id: 'person-old-2', kind: 'person' });
    broken.db
      .prepare(
        `INSERT INTO entity_decisions
          (entity_id, decision_type, target_refs, origin, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('person-old-1', 'duplicate-ok', null, 'xml', '2026-01-01');
    for (const id of ['person-old-1', 'person-old-2']) {
      broken.attachAuthority({
        entityId: id,
        type: 'Wikidata',
        value: 'Q100',
        origin: 'authority',
        source: 'Wikidata',
      });
    }
    expect(broken.listAuthorityDuplicates()).toHaveLength(1);
    const report = broken.backfillDecisionTargets([
      {
        entityId: 'person-old-1',
        decisionType: 'duplicate-ok',
        targetRefs: '#person-old-1 #person-old-2',
      },
    ]);
    expect(report).toEqual({ updated: 1, inserted: 0, unchanged: 0 });
    expect(broken.listAuthorityDuplicates()).toEqual([]);
    expect(
      broken.backfillDecisionTargets([
        {
          entityId: 'person-old-1',
          decisionType: 'duplicate-ok',
          targetRefs: '#person-old-1 #person-old-2',
        },
      ]),
    ).toEqual({ updated: 0, inserted: 0, unchanged: 1 });
    broken.close();
    repository.close();
  });

  it('soft-deletes entities and merges names, authorities, and central mappings', () => {
    const repository = new EntitySqliteRepository();
    repository.createPopulatedEntity({
      id: 'person-keep',
      kind: 'person',
      names: [{ text: '甲', isPrimary: true }],
      authorities: [{ type: 'CBDB', value: '1', origin: 'authority', source: 'CBDB' }],
      description: 'Keeper bio',
    });
    repository.createPopulatedEntity({
      id: 'person-drop',
      kind: 'person',
      names: [
        { text: '甲', isPrimary: true },
        { text: '號甲', nameType: 'courtesy' },
      ],
      authorities: [
        { type: 'CBDB', value: '1', origin: 'authority', source: 'CBDB' },
        { type: 'Wikidata', value: 'Q1', origin: 'authority', source: 'Wikidata' },
      ],
      familyName: '甲氏',
    });
    repository.setCentralMapping('person-drop', 'user-1', 'central-drop');
    repository.setCentralMapping('person-keep', 'user-1', 'central-keep');
    repository.setCentralMapping('person-drop', 'user-2', 'central-only-drop');

    const merged = repository.mergeEntities('person-keep', ['person-drop']);
    expect(merged.remap).toEqual({ 'person-drop': 'person-keep' });
    expect(merged.centralConflicts).toEqual([
      {
        userStableId: 'user-1',
        keptCentralId: 'central-keep',
        droppedCentralId: 'central-drop',
      },
    ]);
    expect(repository.getEntity('person-drop')?.deletedAt).toBeTruthy();
    expect(repository.listEntityIds('person')).toEqual(['person-keep']);
    expect(repository.getPanelSummary('person-keep')?.names.map((name) => name.text)).toEqual(
      expect.arrayContaining(['甲', '號甲']),
    );
    expect(repository.getPanelSummary('person-keep')?.authorities).toEqual(
      expect.arrayContaining([
        { type: 'CBDB', value: '1' },
        { type: 'Wikidata', value: 'Q1' },
      ]),
    );
    expect(repository.getCentralId('person-keep', 'user-2')).toBe('central-only-drop');
    expect(repository.getCentralId('person-keep', 'user-1')).toBe('central-keep');
    expect(repository.listLinkedCentralIds('user-1')).toEqual(['central-keep']);
    expect(repository.listLinkedCentralIds('user-2')).toEqual(['central-only-drop']);
    expect(repository.countActiveEntities()).toBe(1);
    expect(repository.getPanelSummary('person-keep')?.familyName).toBe('甲氏');

    expect(repository.softDeleteEntity('person-keep')).toBe(true);
    expect(repository.listEntityIds('person')).toEqual([]);
    expect(() =>
      repository.createPopulatedEntity({
        id: 'person-keep',
        kind: 'person',
        names: [{ text: '復活', isPrimary: true }],
      }),
    ).toThrow(/resurrect/i);
    repository.close();
  });

  it('finds entities by authority and by unique name+dates for promotion', () => {
    const repository = new EntitySqliteRepository();
    repository.createPopulatedEntity({
      id: 'person-auth',
      kind: 'person',
      names: [{ text: '孔遺', isPrimary: true }],
      authorities: [{ type: 'CBDB', value: '42' }],
    });
    repository.setUserEntityDate({ entityId: 'person-auth', part: 'birth', year: 479 });
    repository.createPopulatedEntity({
      id: 'person-other',
      kind: 'person',
      names: [{ text: '別人', isPrimary: true }],
    });
    expect(repository.findEntityIdByAuthority('person', 'CBDB', '42')).toBe('person-auth');
    expect(repository.findAllEntityIdsByAuthority('person', 'CBDB', '42')).toEqual(['person-auth']);
    expect(repository.findAllEntityIdsByAuthority('place', 'CBDB', '42')).toEqual([]);
    expect(repository.findEntityIdByNameDates('person', '孔遺', 479, null)).toBe('person-auth');
    expect(repository.findEntityIdByNameDates('person', '孔遺', 480, null)).toBeNull();
    repository.close();
  });

  it('returns every entity sharing an authority for lookup conflict planning', () => {
    const repository = new EntitySqliteRepository();
    repository.createPopulatedEntity({
      id: 'person-a',
      kind: 'person',
      names: [{ text: 'A', isPrimary: true }],
      authorities: [{ type: 'Wikidata', value: 'Q1' }],
    });
    repository.createPopulatedEntity({
      id: 'person-b',
      kind: 'person',
      names: [{ text: 'B', isPrimary: true }],
      authorities: [{ type: 'Wikidata', value: 'Q1' }],
    });
    repository.createPopulatedEntity({
      id: 'place-q1',
      kind: 'place',
      names: [{ text: 'Somewhere', isPrimary: true }],
      authorities: [{ type: 'Wikidata', value: 'Q1' }],
    });
    expect(repository.findAllEntityIdsByAuthority('person', 'Wikidata', 'Q1')).toEqual([
      'person-a',
      'person-b',
    ]);
    expect(repository.findEntityIdByAuthority('person', 'Wikidata', 'Q1')).toBe('person-a');
    expect(repository.findAllEntityIdsByAuthority('person', 'Wikidata', 'Q999')).toEqual([]);
    repository.close();
  });

  it('mutates description, dates, nationality, origin, title, authors, and authorities in transactions', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-mut-1', kind: 'person' });
    repository.createEntity({ id: 'work-mut-1', kind: 'work' });
    repository.addName({ entityId: 'person-mut-1', text: '孔遺', isPrimary: true });

    repository.updateDescription('person-mut-1', 'A short biography');
    repository.setUserEntityDate({
      entityId: 'person-mut-1',
      part: 'birth',
      year: 479,
      precision: 'b.',
    });
    repository.setUserEntityDate({
      entityId: 'person-mut-1',
      part: 'death',
      year: 502,
      precision: 'd.',
    });
    expect(repository.addNationality({ entityId: 'person-mut-1', label: '宋' })).toBe(true);
    expect(repository.addOrigin({ entityId: 'person-mut-1', label: '建康' })).toBe(true);
    expect(
      repository.addNobleTitle('person-mut-1', {
        dynasty: '宋',
        fief: '荊國',
        title: '公',
      }),
    ).toBe(true);
    expect(
      repository.attachAuthority({
        entityId: 'person-mut-1',
        type: 'Wikidata',
        value: 'Q42',
      }),
    ).toBe(true);

    repository.setUserWorkDate({
      entityId: 'work-mut-1',
      startYear: 500,
      endYear: 510,
      startPrecision: 'ca.',
    });
    repository.setUserWorkAuthors({
      entityId: 'work-mut-1',
      authors: [{ name: '孔遺', key: 'person-mut-1' }],
    });

    const person = repository.getPanelSummary('person-mut-1');
    expect(person).toMatchObject({
      description: 'A short biography',
      startYear: 479,
      endYear: 502,
      nationalities: ['宋'],
      placesOfOrigin: ['建康'],
    });
    expect(person?.nobleTitles).toEqual([
      expect.objectContaining({ dynasty: '宋', fief: '荊國', title: '公' }),
    ]);
    expect(person?.authorities).toEqual([{ type: 'Wikidata', value: 'Q42' }]);
    expect(person?.assertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: expect.stringMatching(/^entity_dates:\d+$/),
          element: 'birth',
          value: '0479',
        }),
        expect.objectContaining({
          key: expect.stringMatching(/^person_nationalities:\d+$/),
          element: 'nationality',
          value: '宋',
        }),
      ]),
    );

    const work = repository.getPanelSummary('work-mut-1');
    expect(work?.workDate).toEqual({
      startYear: 500,
      endYear: 510,
      startPrecision: 'ca.',
      endPrecision: null,
    });
    expect(work?.authors).toEqual([
      expect.objectContaining({ name: '孔遺', ref: '#person-mut-1' }),
    ]);

    const nationalityKey = person!.assertions.find(
      (assertion) => assertion.element === 'nationality',
    )!.key;
    expect(repository.rejectAssertion('person-mut-1', nationalityKey)).toBe(false); // user origin
    expect(repository.removeAssertion('person-mut-1', nationalityKey)).toBe(true);
    expect(repository.getPanelSummary('person-mut-1')?.nationalities).toEqual([]);

    // Authority rows attached by the user are removable; re-attach as authority-origin for reject.
    repository.db
      .prepare(`UPDATE entity_authorities SET origin = 'authority', source = 'Wikidata' WHERE entity_id = ?`)
      .run('person-mut-1');
    const authorityAssertion = repository
      .getPanelSummary('person-mut-1')!
      .assertions.find((assertion) => assertion.element === 'idno')!;
    expect(repository.rejectAssertion('person-mut-1', authorityAssertion.key)).toBe(true);
    expect(repository.getPanelSummary('person-mut-1')?.authorities).toEqual([]);

    expect(repository.decoupleAuthority({ entityId: 'person-mut-1', type: 'Wikidata', value: 'Q42' })).toBeGreaterThanOrEqual(0);
    repository.close();
  });

  it('mutates family and given names into people scalars and entity_names', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-fg-1', kind: 'person' });
    repository.addName({
      entityId: 'person-fg-1',
      text: '孔遺',
      isPrimary: true,
    });

    expect(
      repository.updateNamesByText({
        entityId: 'person-fg-1',
        text: '孔',
        nameType: 'family',
      }),
    ).toBe(1);
    expect(
      repository.addName({
        entityId: 'person-fg-1',
        text: '遺',
        nameType: 'given',
      }),
    ).toMatchObject({ nameType: 'given', nameRole: 'given' });

    expect(repository.getPanelSummary('person-fg-1')).toMatchObject({
      familyName: '孔',
      givenName: '遺',
    });
    expect(
      repository.db
        .prepare('SELECT family_name, given_name FROM people WHERE entity_id = ?')
        .get('person-fg-1'),
    ).toEqual({ family_name: '孔', given_name: '遺' });

    repository.updateNamesByText({
      entityId: 'person-fg-1',
      text: '孔',
      nameType: 'courtesy',
    });
    expect(repository.getPanelSummary('person-fg-1')?.familyName).toBeNull();
    expect(
      repository.db.prepare('SELECT family_name FROM people WHERE entity_id = ?').get('person-fg-1'),
    ).toEqual({ family_name: null });

    repository.close();
  });

  it('includes office affiliations as role assertions in the panel snapshot', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-office-1', kind: 'person' });
    repository.createEntity({ id: 'office-1', kind: 'office' });
    repository.db
      .prepare(
        `INSERT INTO person_offices
          (person_id, office_id, office_label, reference, origin, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'person-office-1',
        'office-1',
        '尚書令',
        '#office-1',
        'authority',
        'CBDB',
        'active',
        '2026-01-01',
        '2026-01-01',
      );
    repository.db
      .prepare(
        `INSERT INTO person_offices
          (person_id, office_label, origin, source, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'person-office-1',
        '舊職',
        'authority',
        'DILA',
        'rejected',
        '2026-01-01',
        '2026-01-01',
      );

    const snapshot = repository.getPanelSummary('person-office-1')!;
    expect(snapshot.roles).toEqual(['尚書令']);
    expect(snapshot.assertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: expect.stringMatching(/^person_offices:\d+$/),
          element: 'affiliation',
          value: '尚書令',
          origin: 'authority',
          source: 'CBDB',
          status: 'active',
          ref: '#office-1',
        }),
        expect.objectContaining({
          element: 'affiliation',
          value: '舊職',
          status: 'rejected',
          source: 'DILA',
        }),
      ]),
    );
    expect(repository.rejectAssertion('person-office-1', snapshot.assertions.find((a) => a.value === '尚書令')!.key)).toBe(
      true,
    );
    expect(repository.getPanelSummary('person-office-1')?.roles).toEqual([]);
    repository.close();
  });

  it('applies, conflicts, and rejects CBDB concordance associations', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-conc-1', kind: 'person' });
    repository.createEntity({ id: 'person-conc-2', kind: 'person' });
    repository.attachAuthority({
      entityId: 'person-conc-1',
      type: 'CBDB',
      value: '141',
      origin: 'authority',
      source: 'CBDB',
    });
    const association = {
      source: 'CBDB',
      canonicalId: '141',
      mergedFromId: '96120',
      notes: 'same person',
    };

    expect(repository.applyConcordanceAssociations([association])).toMatchObject({
      applied: 1,
      conflicts: [],
    });
    expect(repository.getPanelSummary('person-conc-1')?.authorities).toEqual(
      expect.arrayContaining([
        { type: 'CBDB', value: '141' },
        { type: 'CBDB', value: '96120' },
      ]),
    );

    // Multi-association apply stays batched in one outer transaction.
    repository.createEntity({ id: 'person-conc-3', kind: 'person' });
    repository.attachAuthority({
      entityId: 'person-conc-3',
      type: 'CBDB',
      value: '31',
      origin: 'authority',
      source: 'CBDB',
    });
    expect(
      repository.applyConcordanceAssociations([
        {
          source: 'CBDB',
          canonicalId: '31',
          mergedFromId: '98561',
        },
        {
          source: 'CBDB',
          canonicalId: '55',
          mergedFromId: '468758',
        },
      ]),
    ).toMatchObject({ applied: 1, unresolved: 1 });
    expect(repository.getPanelSummary('person-conc-3')?.authorities).toEqual(
      expect.arrayContaining([
        { type: 'CBDB', value: '31' },
        { type: 'CBDB', value: '98561' },
      ]),
    );

    expect(repository.rejectConcordance(association, 'person-conc-1')).toBe(true);
    expect(repository.applyConcordanceAssociations([association])).toMatchObject({
      rejected: 1,
      applied: 0,
    });
    expect(repository.listConcordanceRejections()).toHaveLength(1);
    expect(repository.getPanelSummary('person-conc-1')?.rejectedConcordances).toHaveLength(1);

    const conflictRepo = new EntitySqliteRepository();
    conflictRepo.createEntity({ id: 'person-a', kind: 'person' });
    conflictRepo.createEntity({ id: 'person-b', kind: 'person' });
    conflictRepo.attachAuthority({
      entityId: 'person-a',
      type: 'CBDB',
      value: '141',
      origin: 'authority',
      source: 'CBDB',
    });
    conflictRepo.attachAuthority({
      entityId: 'person-b',
      type: 'CBDB',
      value: '96120',
      origin: 'authority',
      source: 'CBDB',
    });
    expect(conflictRepo.applyConcordanceAssociations([association]).conflicts).toHaveLength(1);
    conflictRepo.close();
    repository.close();
  });

  it('applies authority backfill patches without resurrecting rejected values', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-bf', kind: 'person' });
    repository.addName({
      entityId: 'person-bf',
      text: '孔遺',
      isPrimary: true,
      origin: 'user',
    });
    repository.db
      .prepare(
        `INSERT INTO entity_names
           (entity_id, text, name_type, name_role, language, is_primary, origin, source, status, created_at, updated_at)
         VALUES (?, '世遠', 'courtesy', 'variant', NULL, 0, 'authority', 'CBDB', 'rejected', ?, ?)`,
      )
      .run('person-bf', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

    const first = repository.applyAuthorityBackfillPatch({
      entityId: 'person-bf',
      names: [
        { text: '世遠', nameType: 'courtesy', source: 'CBDB' },
        { text: '仲達', nameType: 'courtesy', source: 'CBDB' },
      ],
      dates: [{ source: 'CBDB', startYear: 100, endYear: 160 }],
      nationalities: [{ label: '漢', ref: 'Q7209', source: 'CBDB' }],
      familyName: '孔',
      givenName: '遺',
    });
    expect(first).toEqual({ changed: true, namesAdded: 3 });
    const allNames = repository.listNames('person-bf', true).map((name) => name.text);
    expect(allNames).toEqual(expect.arrayContaining(['仲達', '孔遺', '世遠', '孔', '遺']));
    expect(
      repository.listNames('person-bf', true).find((name) => name.text === '世遠')?.status,
    ).toBe('rejected');
    expect(repository.getPanelSummary('person-bf')?.familyName).toBe('孔');
    expect(repository.getPanelSummary('person-bf')?.givenName).toBe('遺');
    expect(repository.getPanelSummary('person-bf')?.startYear).toBe(100);
    expect(repository.getPanelSummary('person-bf')?.nationalities).toContain('漢');

    const second = repository.applyAuthorityBackfillPatch({
      entityId: 'person-bf',
      names: [{ text: '仲達', nameType: 'courtesy', source: 'CBDB' }],
      dates: [{ source: 'CBDB', startYear: 100, endYear: 160 }],
      nationalities: [{ label: '漢', ref: 'Q7209', source: 'CBDB' }],
    });
    expect(second).toEqual({ changed: false, namesAdded: 0 });
    repository.close();
  });

  it('keeps all family variants but sets canonical 姓 from the preferred patch field', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-tuoba', kind: 'person' });
    repository.addName({
      entityId: 'person-tuoba',
      text: '拓拔建',
      isPrimary: true,
      origin: 'authority',
      source: 'NORBERT',
    });

    const result = repository.applyAuthorityBackfillPatch({
      entityId: 'person-tuoba',
      names: [
        { text: '元', nameType: 'family', source: 'NORBERT' },
        { text: '拓拔', nameType: 'family', source: 'NORBERT' },
        { text: '托跋', nameType: 'family', source: 'NORBERT' },
        { text: '建', nameType: 'given', source: 'NORBERT' },
      ],
      familyName: '拓拔',
      givenName: '建',
    });
    expect(result.namesAdded).toBe(4);
    const names = repository.listNames('person-tuoba').map((name) => name.text);
    expect(names).toEqual(expect.arrayContaining(['拓拔建', '元', '拓拔', '托跋', '建']));
    expect(repository.getPanelSummary('person-tuoba')?.familyName).toBe('拓拔');
    expect(repository.getPanelSummary('person-tuoba')?.givenName).toBe('建');

    // Re-backfill can correct a previously wrong scalar that is still one of the variants.
    repository.db
      .prepare('UPDATE people SET family_name = ? WHERE entity_id = ?')
      .run('元', 'person-tuoba');
    const corrected = repository.applyAuthorityBackfillPatch({
      entityId: 'person-tuoba',
      names: [
        { text: '元', nameType: 'family', source: 'NORBERT' },
        { text: '拓拔', nameType: 'family', source: 'NORBERT' },
        { text: '托跋', nameType: 'family', source: 'NORBERT' },
      ],
      familyName: '拓拔',
      givenName: '建',
    });
    expect(corrected.changed).toBe(true);
    expect(repository.getPanelSummary('person-tuoba')?.familyName).toBe('拓拔');
    repository.close();
  });

  it('copies entity content between databases while preserving central mappings', () => {
    const source = new EntitySqliteRepository();
    const target = new EntitySqliteRepository();
    source.createPopulatedEntity({
      id: 'person-src',
      kind: 'person',
      names: [{ text: '孔遺', isPrimary: true }],
      description: 'from project',
    });
    source.addName({
      entityId: 'person-src',
      text: '世遠',
      nameType: 'courtesy',
      origin: 'authority',
      source: 'CBDB',
    });
    source.setUserEntityDate({ entityId: 'person-src', part: 'birth', year: 100 });
    source.addNationality({ entityId: 'person-src', label: '漢' });

    target.createPopulatedEntity({
      id: 'person-dst',
      kind: 'person',
      names: [{ text: 'Placeholder', isPrimary: true }],
      description: 'old',
    });
    target.setCentralMapping('person-dst', 'user-a', 'person-central');

    const beforeCentral = target.getCentralId('person-dst', 'user-a');
    const result = replaceEntityContentBetween(source, 'person-src', target, 'person-dst');
    expect(result.changed).toBe(true);
    expect(target.getCentralId('person-dst', 'user-a')).toBe(beforeCentral);
    expect(target.getEntity('person-dst')?.description).toBe('from project');
    expect(target.listNames('person-dst').map((name) => name.text)).toEqual(
      expect.arrayContaining(['孔遺', '世遠']),
    );
    expect(target.getPanelSummary('person-dst')?.nationalities).toContain('漢');
    expect(computeEntityContentHash(source, 'person-src')).toBe(
      computeEntityContentHash(target, 'person-dst'),
    );
    source.close();
    target.close();
  });

  it('accepts origin=xml on nationality, origin, office, and noble-title adds', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-xml-add', kind: 'person' });
    const source = 'xml:ch1#personWrapper:1';
    expect(
      repository.addNationality({
        entityId: 'person-xml-add',
        label: '齊',
        origin: 'xml',
        source,
      }),
    ).toBe(true);
    expect(
      repository.addOrigin({
        entityId: 'person-xml-add',
        label: '建康',
        origin: 'xml',
        source,
      }),
    ).toBe(true);
    expect(
      repository.addNobleTitle('person-xml-add', {
        fief: '鄱陽',
        title: '王',
        origin: 'xml',
        source,
      }),
    ).toBe(true);
    expect(
      repository.addOffice({
        entityId: 'person-xml-add',
        label: '尚書',
        origin: 'xml',
        source,
      }),
    ).toBe(true);
    expect(
      repository.getPanelSummary('person-xml-add')?.assertions.filter((row) => row.origin === 'xml'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: 'nationality', value: '齊', origin: 'xml', source }),
        expect.objectContaining({ element: 'placeName', value: '建康', origin: 'xml', source }),
        expect.objectContaining({ element: 'nobleTitle', origin: 'xml', source }),
        expect.objectContaining({ element: 'affiliation', value: '尚書', origin: 'xml', source }),
      ]),
    );
    repository.close();
  });

  it('reconciles XML-extracted nationality/office/title with orphan wrapper cleanup', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-xml-1', kind: 'person' });
    repository.addName({ entityId: 'person-xml-1', text: '範', isPrimary: true });

    const first = repository.reconcileXmlExtractedData({
      documentKey: 'chapter-1',
      wrappers: [
        {
          entityId: 'person-xml-1',
          source: 'xml:chapter-1#personWrapper:1',
          assertions: [
            { element: 'nationality', value: '漢' },
            { element: 'state', value: '侍中' },
          ],
        },
      ],
    });
    expect(first).toMatchObject({ wrappers: 1, added: 2, removed: 0 });
    expect(repository.getPanelSummary('person-xml-1')).toMatchObject({
      nationalities: ['漢'],
      roles: ['侍中'],
    });

    // Validated nationality survives refresh that drops it from the wrapper.
    const nationalityKey = repository
      .getPanelSummary('person-xml-1')!
      .assertions.find((row) => row.element === 'nationality')!.key;
    expect(repository.validateAssertion('person-xml-1', nationalityKey)).toBe(true);

    const second = repository.reconcileXmlExtractedData({
      documentKey: 'chapter-1',
      wrappers: [
        {
          entityId: 'person-xml-1',
          source: 'xml:chapter-1#personWrapper:1',
          assertions: [],
        },
      ],
    });
    expect(second.removed).toBe(1); // office only
    expect(repository.getPanelSummary('person-xml-1')?.nationalities).toEqual(['漢']);
    expect(repository.getPanelSummary('person-xml-1')?.roles).toEqual([]);

    // Re-add office, then drop the whole wrapper from the document refresh.
    repository.reconcileXmlExtractedData({
      documentKey: 'chapter-1',
      wrappers: [
        {
          entityId: 'person-xml-1',
          source: 'xml:chapter-1#personWrapper:1',
          assertions: [{ element: 'state', value: '侍中' }],
        },
      ],
    });
    const orphaned = repository.reconcileXmlExtractedData({
      documentKey: 'chapter-1',
      wrappers: [],
    });
    expect(orphaned.removed).toBe(1);
    expect(repository.getPanelSummary('person-xml-1')?.roles).toEqual([]);
    // Validated nationality still present.
    expect(repository.getPanelSummary('person-xml-1')?.nationalities).toEqual(['漢']);
    repository.close();
  });

  it('rolls back a failed transaction', () => {
    const repository = new EntitySqliteRepository();
    expect(() =>
      repository.transaction(() => {
        repository.db
          .prepare(
            `INSERT INTO entities (id, kind, created_at, updated_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run('nested-not-supported', 'place', '2026-01-01', '2026-01-01');
        throw new Error('abort');
      }),
    ).toThrow('abort');
    expect(repository.getEntity('nested-not-supported')).toBeNull();
    repository.close();
  });

  it('autoCleanNames promotes Latn, dedupes typed names, and removes untyped', () => {
    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-auto-clean', kind: 'person' });
    repository.addName({
      entityId: 'person-auto-clean',
      text: '王維',
      isPrimary: true,
      nameType: 'primary',
    });
    repository.addName({
      entityId: 'person-auto-clean',
      text: '摩詰',
      nameType: 'courtesy',
      origin: 'authority',
      source: 'Norbert',
    });
    repository.addName({
      entityId: 'person-auto-clean',
      text: '摩詰',
      nameType: 'courtesy',
      origin: 'authority',
      source: 'Norbert',
    });
    repository.setRomanizedName('person-auto-clean', 'Wang Wei', 'zh-Latn');
    // Force an older untyped Latn (setRomanized now writes translation).
    repository.db
      .prepare(
        `UPDATE entity_names SET name_type = NULL
         WHERE entity_id = ? AND language LIKE '%-Latn'`,
      )
      .run('person-auto-clean');
    repository.addName({
      entityId: 'person-auto-clean',
      text: 'orphan-untyped',
      origin: 'user',
    });

    const report = repository.autoCleanNames();
    expect(report.promotedRomanizations).toBe(1);
    expect(report.dedupedNames).toBe(1);
    expect(report.removedUntyped).toBe(1);

    const names = repository.listNames('person-auto-clean');
    expect(names.filter((n) => n.text === '摩詰')).toHaveLength(1);
    expect(names.find((n) => n.language?.includes('Latn'))).toEqual(
      expect.objectContaining({ nameType: 'translation', text: 'Wang Wei' }),
    );
    expect(names.some((n) => n.text === 'orphan-untyped')).toBe(false);
    repository.close();
  });
});
