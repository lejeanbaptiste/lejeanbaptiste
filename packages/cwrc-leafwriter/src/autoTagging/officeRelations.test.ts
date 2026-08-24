import { addEntity, createEntitiesScaffold, parseEntities, readOfficeRelations } from './entities';
import { recordAdjacentOfficeRelations } from './seed';
import {
  clearAllPluginOfficeRelationExtractors,
  registerPluginOfficeRelationExtractor,
} from '../plugins/officeRelationExtractors';

const candidate = (authorityId: string, followsOffice = false) => ({
  source: 'Norbert',
  authorityId,
  kind: 'office' as const,
  primaryName: authorityId,
  searchStrings: [authorityId],
  metadata: { followsOffice },
});

afterEach(() => clearAllPluginOfficeRelationExtractors());

it('records the plugin-derived parent when resolved office tags are adjacent', () => {
  registerPluginOfficeRelationExtractor('norbert', ({ first, second, adjacent }) =>
    adjacent && second.metadata?.followsOffice
      ? {
          source: 'norbert',
          rule: 'office-concatenation',
          sourceIds: [first.authorityId, second.authorityId],
          confidence: 'inferred',
        }
      : null,
  );
  const corpus = new DOMParser().parseFromString(
    '<TEI><text><p><roleName>尚書省</roleName><roleName>吏部</roleName></p></text></TEI>',
    'application/xml',
  );
  const [firstElement, secondElement] = Array.from(corpus.getElementsByTagName('roleName'));
  const entities = parseEntities(createEntitiesScaffold());
  const parentId = addEntity(entities, 'office', { name: '尚書省' }).id;
  const childId = addEntity(entities, 'office', { name: '吏部' }).id;
  expect(
    recordAdjacentOfficeRelations(entities, [
      { element: firstElement!, entityId: parentId, candidate: candidate('1') },
      { element: secondElement!, entityId: childId, candidate: candidate('2', true) },
    ]),
  ).toBe(1);
  expect(readOfficeRelations(entities)[0]).toMatchObject({
    parentId,
    childId,
    source: 'norbert',
    rule: 'office-concatenation',
    sourceIds: ['1', '2'],
  });
});

it('does not record a relation across intervening text', () => {
  registerPluginOfficeRelationExtractor('norbert', ({ adjacent }) =>
    adjacent
      ? {
          source: 'norbert',
          rule: 'office-concatenation',
          sourceIds: ['1', '2'],
          confidence: 'inferred',
        }
      : null,
  );
  const corpus = new DOMParser().parseFromString(
    '<TEI><text><p><roleName>A</roleName>與<roleName>B</roleName></p></text></TEI>',
    'application/xml',
  );
  const [firstElement, secondElement] = Array.from(corpus.getElementsByTagName('roleName'));
  const entities = parseEntities(createEntitiesScaffold());
  expect(
    recordAdjacentOfficeRelations(entities, [
      {
        element: firstElement!,
        entityId: addEntity(entities, 'office', { name: 'A' }).id,
        candidate: candidate('1'),
      },
      {
        element: secondElement!,
        entityId: addEntity(entities, 'office', { name: 'B' }).id,
        candidate: candidate('2', true),
      },
    ]),
  ).toBe(0);
});
