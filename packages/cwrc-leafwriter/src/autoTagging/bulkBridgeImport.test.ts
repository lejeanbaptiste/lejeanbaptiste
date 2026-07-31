import { getCentralId } from './concordance';
import { addEntity, createEntitiesScaffold, findEntity, parseEntities } from './entities';
import { bulkBridgeImport } from './bulkBridgeImport';

const doc = () => parseEntities(createEntitiesScaffold());

describe('bulkBridgeImport', () => {
  it('matches exact authorities, unions rich assertions, and proposes unmatched rows', async () => {
    const source = doc();
    const central = doc();
    const centralPerson = addEntity(central, 'person', {
      name: '張衡',
      authorityIds: [{ type: 'NORBERT', value: '42' }],
    });
    const sourcePerson = addEntity(source, 'person', {
      name: '张衡',
      altNames: [{ text: '平子', type: 'courtesy' }],
      authorityIds: [{ type: 'norbert', value: '42' }],
    });
    const sourceUnmatched = addEntity(source, 'person', { name: '未匹配' });
    const nationality = source.createElementNS('http://www.tei-c.org/ns/1.0', 'nationality');
    nationality.textContent = '魏';
    sourcePerson.element.appendChild(nationality);

    const progressStages: string[] = [];
    const result = await bulkBridgeImport({
      sourceDoc: source,
      centralDoc: central,
      userStableId: 'test-user',
      chunkSize: 25,
      onProgress: (progress) => progressStages.push(progress.stage),
    });

    expect(result.matched).toBe(1);
    expect(result.proposed).toBe(1);
    expect(result.ambiguous).toBe(0);
    expect(result.proposals[0]?.sourceId).toBe(sourceUnmatched.id);
    expect(getCentralId(sourcePerson.element, 'test-user')).toBe(centralPerson.id);
    expect(findEntity(central, centralPerson.id)?.textContent).toContain('魏');
    expect(progressStages).toContain('indexing');
    expect(progressStages).toContain('matching');
    expect(progressStages).toContain('merging');
    expect(progressStages.at(-1)).toBe('complete');
  });

  it('does not silently choose when an authority is duplicated centrally', async () => {
    const source = doc();
    const central = doc();
    addEntity(central, 'person', { name: '甲', authorityIds: [{ type: 'NORBERT', value: '7' }] });
    addEntity(central, 'person', { name: '乙', authorityIds: [{ type: 'NORBERT', value: '7' }] });
    addEntity(source, 'person', { name: '丙', authorityIds: [{ type: 'NORBERT', value: '7' }] });

    const result = await bulkBridgeImport({ sourceDoc: source, centralDoc: central, userStableId: 'test-user' });

    expect(result.matched).toBe(0);
    expect(result.ambiguous).toBe(1);
    expect(result.proposals[0]?.reason).toBe('ambiguous-authority-match');
  });
});
