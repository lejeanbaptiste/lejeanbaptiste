import { addEntity, createEntitiesScaffold, parseEntities } from './entities';
import { candidatesFromEntityDatabase } from './ownDatabaseCandidates';

describe('candidatesFromEntityDatabase', () => {
  it('recovers search strings, dates, and description for a person', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'person', {
      name: '王安石',
      altNames: [{ text: 'Wang Anshi' }],
      description: 'Song dynasty statesman',
      startYear: 1021,
      endYear: 1086,
    });

    const [candidate] = candidatesFromEntityDatabase(doc, 'person', 'PEDB');
    expect(candidate).toBeDefined();
    expect(candidate!.source).toBe('PEDB');
    expect(candidate!.kind).toBe('person');
    expect(candidate!.primaryName).toBe('王安石');
    expect(candidate!.searchStrings).toEqual(expect.arrayContaining(['王安石', 'Wang Anshi']));
    expect(candidate!.metadata?.description).toBe('Song dynasty statesman');
    expect(candidate!.metadata?.startYear).toBe(1021);
    expect(candidate!.metadata?.endYear).toBe(1086);
  });

  it('recovers dates from the note[type=dates] fallback for a place', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'place', {
      name: '建康',
      description: 'Capital of several southern dynasties',
      startYear: 229,
      endYear: 589,
    });

    const [candidate] = candidatesFromEntityDatabase(doc, 'place', 'CEDB');
    expect(candidate).toBeDefined();
    expect(candidate!.source).toBe('CEDB');
    expect(candidate!.kind).toBe('place');
    expect(candidate!.primaryName).toBe('建康');
    expect(candidate!.metadata?.description).toBe('Capital of several southern dynasties');
    expect(candidate!.metadata?.startYear).toBe(229);
    expect(candidate!.metadata?.endYear).toBe(589);
  });

  it('returns no candidates for an empty kind list', () => {
    const doc = parseEntities(createEntitiesScaffold());
    expect(candidatesFromEntityDatabase(doc, 'org', 'PEDB')).toEqual([]);
  });

  it('skips entities without any name text', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const { element } = addEntity(doc, 'work', { name: 'placeholder' });
    element.getElementsByTagName('title')[0]!.textContent = '   ';

    expect(candidatesFromEntityDatabase(doc, 'work', 'PEDB')).toEqual([]);
  });
});
