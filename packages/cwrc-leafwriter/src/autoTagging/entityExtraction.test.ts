import { addEntity, createEntitiesScaffold, findEntity, parseEntities } from './entities';
import {
  ingestExtractedEntityData,
  refreshExtractedEntityDataForDocument,
} from './entityExtraction';

describe('entity extraction reconciliation', () => {
  it('removes missing unvalidated XML assertions but keeps validated values', () => {
    const doc = parseEntities(createEntitiesScaffold('test-db'));
    const { id } = addEntity(doc, 'person', { name: '張衡' });
    const source = 'xml:chapter-1#wrapper-7';
    expect(
      ingestExtractedEntityData(doc, id, source, [{ element: 'nationality', value: '漢' }]),
    ).toMatchObject({ added: 1, removed: 0 });
    const entity = findEntity(doc, id)!;
    const nationality = entity.getElementsByTagName('nationality')[0]!;
    nationality.setAttribute('origin', 'user');

    expect(ingestExtractedEntityData(doc, id, source, [])).toMatchObject({
      added: 0,
      removed: 0,
    });
    expect(entity.getElementsByTagName('nationality')).toHaveLength(1);
  });

  it('cleans up assertions when a keyed person wrapper is unwrapped', () => {
    const entities = parseEntities(createEntitiesScaffold('test-db'));
    const { id } = addEntity(entities, 'person', { name: '範' });
    const corpus = parseEntities(
      `<TEI><text><name type="personWrapper" key="${id}"><nationality>漢</nationality><persName key="${id}">範</persName></name></text></TEI>`,
    );
    const extract = (wrapper: Element) =>
      Array.from(wrapper.getElementsByTagName('nationality')).map((element) => ({
        element: 'nationality',
        value: element.textContent!.trim(),
      }));
    expect(
      refreshExtractedEntityDataForDocument(entities, corpus, 'chapter-1', extract).added,
    ).toBe(1);
    const wrapper = corpus.getElementsByTagName('name')[0]!;
    wrapper.removeAttribute('type');
    wrapper.removeAttribute('key');
    expect(
      refreshExtractedEntityDataForDocument(entities, corpus, 'chapter-1', extract).removed,
    ).toBe(1);
  });
});
