import { addEntity, createEntitiesScaffold, parseEntities } from './entities';
import { listEntities, setFamilyName, setGivenName } from './entityOps';
import { normalizeDomText } from './normalize';
import { resolveNameTypeTaggingPolicy } from './nameTypeTaggingPolicy';
import { keyedPersNameFloors, phase2StringsForEntity, shortFormTag } from './shortFormTag';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

const parseTei = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const makeEntitiesDoc = () => parseEntities(createEntitiesScaffold('short-form-test'));

const zhPolicy = resolveNameTypeTaggingPolicy(undefined, 'zh');

describe('keyedPersNameFloors', () => {
  it('records the earliest search-text offset per keyed entity', () => {
    const doc = parseTei(
      `<TEI xmlns="${TEI_NS}"><text><body><p>
<persName key="p1">甲</persName> middle <persName key="p2">乙</persName> tail <persName key="p1">甲</persName>
</p></body></text></TEI>`,
    );
    const floors = keyedPersNameFloors(doc, 'ignore');
    expect(floors.get('p1')).toBe(0);
    expect(floors.get('p2')).toBeGreaterThan(floors.get('p1')!);
  });
});

describe('phase2StringsForEntity', () => {
  it('includes phase-2 typed names but not family when family is never', () => {
    const entitiesDoc = makeEntitiesDoc();
    const { id } = addEntity(entitiesDoc, 'person', {
      name: '王安石',
      altNames: [{ text: '介甫', type: 'courtesy' }],
    });
    setFamilyName(entitiesDoc, id, '王');
    const entity = listEntities(entitiesDoc).find((row) => row.id === id)!;

    const seeds = phase2StringsForEntity(entity, zhPolicy);
    expect(seeds.map((s) => s.text)).toEqual(['介甫']);
    expect(seeds[0]).toMatchObject({ type: 'courtesy', entityLabel: '王安石' });
  });

  it('includes given names from the givenName note when given is phase-2', () => {
    const entitiesDoc = makeEntitiesDoc();
    const { id } = addEntity(entitiesDoc, 'person', { name: '張衡' });
    setGivenName(entitiesDoc, id, '衡');
    const entity = listEntities(entitiesDoc).find((row) => row.id === id)!;

    expect(phase2StringsForEntity(entity, zhPolicy).map((s) => s.text)).toEqual(['衡']);
  });
});

describe('shortFormTag', () => {
  it('suggests a keyed entity short form after its first keyed mention', () => {
    const entitiesDoc = makeEntitiesDoc();
    const { id } = addEntity(entitiesDoc, 'person', {
      name: '王安石',
      altNames: [{ text: '介甫', type: 'courtesy' }],
    });
    const entity = listEntities(entitiesDoc).find((row) => row.id === id)!;

    const doc = parseTei(
      `<TEI xmlns="${TEI_NS}"><text><body><p>初見<persName key="${id}">王安石</persName>，後稱介甫。</p></body></text></TEI>`,
    );
    const floors = keyedPersNameFloors(doc, 'ignore');
    const suggestions = shortFormTag(doc, new Map([[id, entity]]), floors, {
      policy: zhPolicy,
      whitespacePolicy: 'ignore',
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.anchor.surface).toBe('介甫');
    expect(suggestions[0]!.attributes).toEqual({ key: id });
    expect(suggestions[0]!.sourceDetail).toBe('short-form');
    expect(suggestions[0]!.rationale).toContain('courtesy');
    expect(suggestions[0]!.rationale).toContain('王安石');
  });

  it('skips matches before the first keyed mention when startFromFirstAppearance is on', () => {
    const entitiesDoc = makeEntitiesDoc();
    const { id } = addEntity(entitiesDoc, 'person', {
      name: '王安石',
      altNames: [{ text: '介甫', type: 'courtesy' }],
    });
    const entity = listEntities(entitiesDoc).find((row) => row.id === id)!;

    const doc = parseTei(
      `<TEI xmlns="${TEI_NS}"><text><body><p>介甫先至，後見<persName key="${id}">王安石</persName>。</p></body></text></TEI>`,
    );
    const floors = keyedPersNameFloors(doc, 'ignore');
    const suggestions = shortFormTag(doc, new Map([[id, entity]]), floors, {
      policy: zhPolicy,
      whitespacePolicy: 'ignore',
      startFromFirstAppearance: true,
    });

    expect(suggestions).toHaveLength(0);
  });

  it('emits one alternative suggestion per entity when several share a short form', () => {
    const entitiesDoc = makeEntitiesDoc();
    const first = addEntity(entitiesDoc, 'person', {
      name: '甲',
      altNames: [{ text: '衡', type: 'given' }],
    });
    const second = addEntity(entitiesDoc, 'person', {
      name: '乙',
      altNames: [{ text: '衡', type: 'given' }],
    });
    const entityA = listEntities(entitiesDoc).find((row) => row.id === first.id)!;
    const entityB = listEntities(entitiesDoc).find((row) => row.id === second.id)!;

    const doc = parseTei(
      `<TEI xmlns="${TEI_NS}"><text><body><p>
<persName key="${first.id}">甲</persName>與<persName key="${second.id}">乙</persName>皆言衡。
</p></body></text></TEI>`,
    );
    const floors = keyedPersNameFloors(doc, 'ignore');
    const suggestions = shortFormTag(
      doc,
      new Map([
        [first.id, entityA],
        [second.id, entityB],
      ]),
      floors,
      { policy: zhPolicy, whitespacePolicy: 'ignore' },
    );

    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((s) => s.anchor.surface === '衡')).toBe(true);
    expect(new Set(suggestions.map((s) => s.attributes?.key))).toEqual(
      new Set([first.id, second.id]),
    );
    expect(suggestions[0]!.anchor.xpath).toBe(suggestions[1]!.anchor.xpath);
    expect(suggestions[0]!.anchor.occurrence).toBe(suggestions[1]!.anchor.occurrence);
  });

  it('matches single-character given names (min length 1)', () => {
    const entitiesDoc = makeEntitiesDoc();
    const { id } = addEntity(entitiesDoc, 'person', { name: '張衡' });
    setGivenName(entitiesDoc, id, '衡');
    const entity = listEntities(entitiesDoc).find((row) => row.id === id)!;

    const doc = parseTei(
      `<TEI xmlns="${TEI_NS}"><text><body><p><persName key="${id}">張衡</persName>稱衡。</p></body></text></TEI>`,
    );
    const floors = keyedPersNameFloors(doc, 'ignore');
    const suggestions = shortFormTag(doc, new Map([[id, entity]]), floors, {
      policy: zhPolicy,
      whitespacePolicy: 'ignore',
    });

    expect(suggestions.some((s) => s.anchor.surface === '衡')).toBe(true);
  });

  it('does not seed family names when family is in the never bucket', () => {
    const entitiesDoc = makeEntitiesDoc();
    const { id } = addEntity(entitiesDoc, 'person', { name: '王安石' });
    setFamilyName(entitiesDoc, id, '王');
    const entity = listEntities(entitiesDoc).find((row) => row.id === id)!;

    expect(phase2StringsForEntity(entity, zhPolicy).some((s) => s.text === '王')).toBe(false);

    const doc = parseTei(
      `<TEI xmlns="${TEI_NS}"><text><body><p><persName key="${id}">王安石</persName>姓王。</p></body></text></TEI>`,
    );
    const floors = keyedPersNameFloors(doc, 'ignore');
    const suggestions = shortFormTag(doc, new Map([[id, entity]]), floors, {
      policy: zhPolicy,
      whitespacePolicy: 'ignore',
    });

    expect(suggestions.filter((s) => s.anchor.surface === '王')).toHaveLength(0);
  });

  it('skips nested text inside an existing persName', () => {
    const entitiesDoc = makeEntitiesDoc();
    const { id } = addEntity(entitiesDoc, 'person', {
      name: '王安石',
      altNames: [{ text: '介甫', type: 'courtesy' }],
    });
    const entity = listEntities(entitiesDoc).find((row) => row.id === id)!;

    const doc = parseTei(
      `<TEI xmlns="${TEI_NS}"><text><body><p><persName key="${id}">王安石介甫</persName></p></body></text></TEI>`,
    );
    const floors = keyedPersNameFloors(doc, 'ignore');
    const suggestions = shortFormTag(doc, new Map([[id, entity]]), floors, {
      policy: zhPolicy,
      whitespacePolicy: 'ignore',
    });

    expect(suggestions).toHaveLength(0);
  });
});
