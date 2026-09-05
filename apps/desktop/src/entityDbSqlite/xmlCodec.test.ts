import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EntitySqliteRepository } from './repository';
import {
  backfillDecisionTargetsFromXml,
  exportEntitiesXml,
  extractDecisionTargetEntriesFromXml,
  importEntitiesXml,
} from './xmlCodec';

describe('entity XML codec', () => {
  it('imports the legacy entity database and exports a re-importable database', () => {
    const xml = readFileSync(join(__dirname, 'fixtures/legacy-entities.xml'), 'utf8');
    const first = new EntitySqliteRepository();
    const imported = importEntitiesXml(first, xml);

    expect(imported.databaseId).toBe('b1e98777-6266-413b-b125-7f6d5ec5bcc8');
    expect(imported.entitiesImported).toBe(4);
    expect(imported.namesImported).toBe(9);
    expect(imported.authoritiesImported).toBe(10);
    expect(imported.duplicateEntityIds).toEqual([]);
    expect(imported.unresolvedReferences).toEqual([]);
    expect(first.getSummary('person-40f8324a-1498-4a87-aa27-f4025a9f2e99')?.names[0]?.text).toBe(
      '江祏',
    );
    expect(first.getSummary('work-828e5bea-eecd-4e0b-8fe1-b07b137041bc')?.names[0]?.text).toBe(
      '南齊書',
    );

    const exported = exportEntitiesXml(first);
    const second = new EntitySqliteRepository();
    const reimported = importEntitiesXml(second, exported);

    expect(reimported.entitiesImported).toBe(4);
    expect(second.listEntities()).toHaveLength(4);
    expect(second.listNames('person-40f8324a-1498-4a87-aa27-f4025a9f2e99', true)).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: '江祏' })]),
    );
    expect(second.integrityCheck()).toEqual(['ok']);
    first.close();
    second.close();
  });

  it('structures date ranges, name roles, office data, relations, and extension data', () => {
    const xml = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0">
      <teiHeader><fileDesc><titleStmt><title>Test</title></titleStmt><publicationStmt><idno type="ljb-entity-database">test-db</idno></publicationStmt><sourceDesc><p>Source</p></sourceDesc></fileDesc></teiHeader>
      <standOff>
        <listPerson><person xml:id="person-a"><persName type="primary">甲</persName><note type="familyName">甲氏</note><note type="dates" from="0479" to="0502" fromCirca="true" notAfter="0503" dateSystem="sanmiao" calendarPayload="{&quot;era&quot;:&quot;永明&quot;}">era text</note><affiliation ref="#office-a">尚書令</affiliation><note type="authority-cache" source="CBDB" when="2026-01-01">{&quot;x&quot;:1}</note><note type="duplicate-ok">reviewed</note></person></listPerson>
        <listOrg type="offices"><org xml:id="office-a"><orgName type="primary">尚書令</orgName><state type="office-classification" ref="CBDB:1">civil</state></org></listOrg>
        <listBibl><bibl xml:id="work-a"><title type="primary">A Work</title><author><persName ref="#person-a">甲</persName></author></bibl></listBibl>
        <listRelation type="office-hierarchy"><relation name="parentOf" active="#office-a" passive="#office-a" mutual="true"/></listRelation>
      </standOff>
    </TEI>`;
    const repository = new EntitySqliteRepository();
    const report = importEntitiesXml(repository, xml);

    expect(report.entitiesImported).toBe(3);
    expect(report.duplicateEntityIds).toEqual([]);
    expect(report.unresolvedReferences).toEqual([]);
    expect(
      repository.db
        .prepare("SELECT name_role FROM entity_names WHERE entity_id = ? AND name_role = 'family'")
        .get('person-a'),
    ).toEqual(expect.objectContaining({ name_role: 'family' }));
    expect(
      repository.db.prepare('SELECT family_name FROM people WHERE entity_id = ?').get('person-a'),
    ).toEqual({ family_name: '甲氏' });
    expect(
      repository.db
        .prepare(
          'SELECT from_circa, not_after, date_system, calendar_payload FROM entity_dates WHERE entity_id = ?',
        )
        .get('person-a'),
    ).toEqual(
      expect.objectContaining({ from_circa: 1, not_after: '0503', date_system: 'sanmiao' }),
    );
    expect(
      repository.db
        .prepare('SELECT COUNT(*) AS count FROM person_offices WHERE person_id = ?')
        .get('person-a'),
    ).toEqual({ count: 1 });
    expect(
      repository.db
        .prepare('SELECT COUNT(*) AS count FROM office_classifications WHERE office_id = ?')
        .get('office-a'),
    ).toEqual({ count: 1 });
    expect(repository.db.prepare('SELECT COUNT(*) AS count FROM entity_relations').get()).toEqual({
      count: 1,
    });
    expect(repository.db.prepare('SELECT COUNT(*) AS count FROM authority_caches').get()).toEqual({
      count: 1,
    });
    expect(repository.db.prepare('SELECT COUNT(*) AS count FROM entity_decisions').get()).toEqual({
      count: 1,
    });

    const exported = exportEntitiesXml(repository);
    expect(exported).toContain('fromCirca="true"');
    expect(exported).toContain('dateSystem="sanmiao"');
    expect(exported).toContain('listRelation');
    expect(exported).toContain('type="familyName"');
    expect(exported).toContain('>甲氏</note>');
    repository.close();
  });

  it('extracts and backfills decision target refs from sibling XML', () => {
    const xml = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0">
      <teiHeader><fileDesc><titleStmt><title>Test</title></titleStmt><publicationStmt><idno type="ljb-entity-database">test-db</idno></publicationStmt><sourceDesc><p>Source</p></sourceDesc></fileDesc></teiHeader>
      <standOff>
        <listPerson>
          <person xml:id="person-a"><persName>甲</persName><note type="duplicate-ok" target="#person-a #person-b">ok</note></person>
          <person xml:id="person-b"><persName>乙</persName><note type="concordance-rejected" source="CBDB" target="CBDB:1 CBDB:2"/></person>
        </listPerson>
      </standOff>
    </TEI>`;
    expect(extractDecisionTargetEntriesFromXml(xml)).toEqual([
      {
        entityId: 'person-a',
        decisionType: 'duplicate-ok',
        targetRefs: '#person-a #person-b',
        source: null,
        payloadJson: 'ok',
      },
      {
        entityId: 'person-b',
        decisionType: 'concordance-rejected',
        targetRefs: 'CBDB:1 CBDB:2',
        source: 'CBDB',
        payloadJson: null,
      },
    ]);

    const repository = new EntitySqliteRepository();
    repository.createEntity({ id: 'person-a', kind: 'person' });
    repository.createEntity({ id: 'person-b', kind: 'person' });
    repository.db
      .prepare(
        `INSERT INTO entity_decisions
          (entity_id, decision_type, target_refs, origin, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('person-a', 'duplicate-ok', null, 'xml', '2026-01-01');
    const report = backfillDecisionTargetsFromXml(repository, xml);
    expect(report).toEqual({ updated: 1, inserted: 1, unchanged: 0 });
    expect(
      repository.db
        .prepare(
          `SELECT target_refs FROM entity_decisions
           WHERE entity_id = ? AND decision_type = 'duplicate-ok'`,
        )
        .get('person-a'),
    ).toEqual({ target_refs: '#person-a #person-b' });
    repository.close();
  });

  it('round-trips a "thing" entity and a relation through export/import', () => {
    const repository = new EntitySqliteRepository();
    repository.createPopulatedEntity({
      id: 'thing-qi',
      kind: 'thing',
      description: 'A foundational concept',
      names: [{ text: '氣', isPrimary: true }],
    });
    repository.updateSubtype('thing-qi', 'philosophical_concept');
    repository.createEntity({ id: 'person-zhuangzi', kind: 'person' });
    repository.createRelation({
      subjectEntityId: 'person-zhuangzi',
      objectEntityId: 'thing-qi',
      relationType: 'discussion',
    });

    const exported = exportEntitiesXml(repository, { databaseId: 'test-thing-db' });
    expect(exported).toContain('<list type="things">');
    expect(exported).toContain('xml:id="thing-qi"');
    expect(exported).toContain('name="discussion"');
    expect(exported).toContain('<note type="subtype">philosophical_concept</note>');
    repository.close();

    const reimported = new EntitySqliteRepository();
    const report = importEntitiesXml(reimported, exported);

    expect(report.unresolvedReferences).toEqual([]);
    expect(reimported.getEntity('thing-qi')?.kind).toBe('thing');
    expect(
      reimported.db.prepare('SELECT 1 FROM things WHERE entity_id = ?').get('thing-qi'),
    ).toEqual({ 1: 1 });
    expect(reimported.getPanelSummary('thing-qi')?.subtype).toBe('philosophical_concept');
    expect(
      reimported.db
        .prepare('SELECT relation_type, subject_entity_id, object_entity_id FROM entity_relations')
        .get(),
    ).toEqual({
      relation_type: 'discussion',
      subject_entity_id: 'person-zhuangzi',
      object_entity_id: 'thing-qi',
    });
    reimported.close();
  });
});
