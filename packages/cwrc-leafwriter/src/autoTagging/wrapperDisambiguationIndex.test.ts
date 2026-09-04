import {
  buildWrapperDisambiguationIndex,
  buildWrapperDisambiguationIndexFromFacts,
  wrapperDisambiguationIndexFromPack,
  wrapperDisambiguationQueryFromElement,
  wrapperIdentityElement,
} from './wrapperDisambiguationIndex';
import type { AuthorityCandidate } from './authority';
import type { WrapperFactRecord } from './wrapperFactsLog';

const parseWrapper = (xml: string): Element => {
  const doc = new DOMParser().parseFromString(
    `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>${xml}</p></body></text></TEI>`,
    'application/xml',
  );
  return doc.getElementsByTagName('name')[0]!;
};

const person = (over: Partial<AuthorityCandidate> = {}): AuthorityCandidate => ({
  source: 'Norbert',
  authorityId: 'person-1',
  kind: 'person',
  primaryName: '範',
  searchStrings: ['範'],
  ...over,
});

describe('buildWrapperDisambiguationIndex', () => {
  it('resolves by given name alone', () => {
    const index = buildWrapperDisambiguationIndex([
      person({ authorityId: 'p1', names: [{ text: '範', type: 'given' }] }),
    ]);
    expect(index.resolve({ persName: '範' })).toEqual(['p1']);
  });

  it('resolves by surname+given name too', () => {
    const index = buildWrapperDisambiguationIndex([
      person({
        authorityId: 'p1',
        names: [
          { text: '柳', type: 'family' },
          { text: '世隆', type: 'given' },
        ],
      }),
    ]);
    expect(index.resolve({ persName: '柳世隆' })).toEqual(['p1']);
    expect(index.resolve({ persName: '世隆' })).toEqual(['p1']);
  });

  it('falls back to a coarser name when 姓/名 are not split out', () => {
    const index = buildWrapperDisambiguationIndex([
      person({ authorityId: 'p1', names: [{ text: '範', type: 'primary' }] }),
    ]);
    expect(index.resolve({ persName: '範' })).toEqual(['p1']);
  });

  it('returns nothing for an unknown name', () => {
    const index = buildWrapperDisambiguationIndex([
      person({ authorityId: 'p1', names: [{ text: '範', type: 'given' }] }),
    ]);
    expect(index.resolve({ persName: '未知' })).toEqual([]);
  });

  it('leaves an ambiguous shared name ambiguous when no narrowing field is given', () => {
    const index = buildWrapperDisambiguationIndex([
      person({ authorityId: 'p1', names: [{ text: '範', type: 'given' }] }),
      person({ authorityId: 'p2', names: [{ text: '範', type: 'given' }] }),
    ]);
    expect(index.resolve({ persName: '範' }).sort()).toEqual(['p1', 'p2']);
  });

  it('narrows an ambiguous name down to one by origin place', () => {
    const index = buildWrapperDisambiguationIndex([
      person({
        authorityId: 'p1',
        names: [{ text: '範', type: 'given' }],
        metadata: { origin: [{ originType: 'jiguan', placeName: '陳郡' }] },
      }),
      person({
        authorityId: 'p2',
        names: [{ text: '範', type: 'given' }],
        metadata: { origin: [{ originType: 'jiguan', placeName: '汝南' }] },
      }),
    ]);
    expect(index.resolve({ persName: '範', originPlace: '陳郡' })).toEqual(['p1']);
  });

  it('narrows an ambiguous name down to one by office', () => {
    const index = buildWrapperDisambiguationIndex([
      person({
        authorityId: 'p1',
        names: [{ text: '範', type: 'given' }],
        metadata: {
          appointments: [
            {
              source: 'Norbert',
              authorityId: 'a1',
              person: { source: 'Norbert', authorityId: 'p1' },
              office: { source: 'Norbert', name: '刺史' },
            },
          ],
        },
      }),
      person({ authorityId: 'p2', names: [{ text: '範', type: 'given' }] }),
    ]);
    expect(index.resolve({ persName: '範', officeName: '刺史' })).toEqual(['p1']);
  });

  it('narrows an ambiguous name down to one by nobleTitle fief+rank', () => {
    const index = buildWrapperDisambiguationIndex([
      person({
        authorityId: 'p1',
        names: [{ text: '休仁', type: 'given' }],
        metadata: { dynasty: '宋', nobleTitles: [{ fief: '建安', roleName: '王' }] },
      }),
      person({
        authorityId: 'p2',
        names: [{ text: '休仁', type: 'given' }],
        metadata: { dynasty: '宋', nobleTitles: [{ fief: '江夏', roleName: '王' }] },
      }),
    ]);
    expect(
      index.resolve({
        persName: '休仁',
        dynasty: '宋',
        nobleTitle: { fief: '建安', roleName: '王' },
      }),
    ).toEqual(['p1']);
  });

  it("keys a title on its own dynasty, not the person's overall dynasty label", () => {
    // Real Norbert data: a person's overall metadata.dynasty can be a fuller
    // label (e.g. 劉宋) while the title row's own dynasty (person_nt.dyn) is
    // shorter (e.g. 宋) — the title-specific value must win.
    const index = buildWrapperDisambiguationIndex([
      person({
        authorityId: 'p1',
        names: [{ text: '休仁', type: 'given' }],
        metadata: {
          dynasty: '劉宋',
          nobleTitles: [{ dynasty: '宋', fief: '建安', roleName: '王' }],
        },
      }),
    ]);
    expect(
      index.resolve({
        persName: '休仁',
        dynasty: '宋',
        nobleTitle: { fief: '建安', roleName: '王' },
      }),
    ).toEqual(['p1']);
    expect(
      index.resolve({
        persName: '休仁',
        dynasty: '劉宋',
        nobleTitle: { fief: '建安', roleName: '王' },
      }),
    ).toEqual([]);
  });

  it('returns nothing when a populated field rules out every remaining candidate', () => {
    const index = buildWrapperDisambiguationIndex([
      person({
        authorityId: 'p1',
        names: [{ text: '範', type: 'given' }],
        metadata: { origin: [{ originType: 'jiguan', placeName: '陳郡' }] },
      }),
    ]);
    expect(index.resolve({ persName: '範', originPlace: '汝南' })).toEqual([]);
  });

  it('applies multiple narrowing fields together (intersection, not union)', () => {
    const index = buildWrapperDisambiguationIndex([
      person({
        authorityId: 'p1',
        names: [{ text: '範', type: 'given' }],
        metadata: {
          origin: [{ originType: 'jiguan', placeName: '陳郡' }],
          appointments: [
            {
              source: 'Norbert',
              authorityId: 'a1',
              person: { source: 'Norbert', authorityId: 'p1' },
              office: { source: 'Norbert', name: '刺史' },
            },
          ],
        },
      }),
      // Same origin, different office — must not match when both are given.
      person({
        authorityId: 'p2',
        names: [{ text: '範', type: 'given' }],
        metadata: {
          origin: [{ originType: 'jiguan', placeName: '陳郡' }],
          appointments: [
            {
              source: 'Norbert',
              authorityId: 'a2',
              person: { source: 'Norbert', authorityId: 'p2' },
              office: { source: 'Norbert', name: '太守' },
            },
          ],
        },
      }),
    ]);
    expect(index.resolve({ persName: '範', originPlace: '陳郡', officeName: '刺史' })).toEqual([
      'p1',
    ]);
  });

  it('ignores non-person records', () => {
    const index = buildWrapperDisambiguationIndex([
      { ...person({ authorityId: 'place-1' }), kind: 'place' },
    ]);
    expect(index.resolve({ persName: '範' })).toEqual([]);
  });
});

describe('wrapperDisambiguationIndexFromPack', () => {
  it('builds from raw NDJSON pack content', () => {
    const line = JSON.stringify(
      person({ authorityId: 'p1', names: [{ text: '範', type: 'given' }] }),
    );
    const index = wrapperDisambiguationIndexFromPack(line);
    expect(index.resolve({ persName: '範' })).toEqual(['p1']);
  });
});

describe('buildWrapperDisambiguationIndexFromFacts', () => {
  const wrapperFact = (over: Partial<WrapperFactRecord> = {}): WrapperFactRecord => ({
    when: '2026-01-01T00:00:00.000Z',
    query: { persName: '休仁', dynasty: '宋', nobleTitle: { fief: '建安', roleName: '王' } },
    entityId: 'entity-1',
    ...over,
  });

  it('resolves a previously harvested combination', () => {
    const index = buildWrapperDisambiguationIndexFromFacts([wrapperFact()]);
    expect(
      index.resolve({
        persName: '休仁',
        dynasty: '宋',
        nobleTitle: { fief: '建安', roleName: '王' },
      }),
    ).toEqual(['entity-1']);
  });

  it('only indexes the fields a fact actually carries — no regeneration', () => {
    const index = buildWrapperDisambiguationIndexFromFacts([
      wrapperFact({ query: { persName: '範' }, entityId: 'entity-2' }),
    ]);
    // A bare name-only fact matches a bare name-only query...
    expect(index.resolve({ persName: '範' })).toEqual(['entity-2']);
    // ...but never a query narrowed by a field this fact never recorded —
    // there is no evidence it's the same combination, so it doesn't match.
    expect(index.resolve({ persName: '範', originPlace: '陳郡' })).toEqual([]);
  });

  it('narrows two harvested facts for the same name by whichever field distinguishes them', () => {
    const index = buildWrapperDisambiguationIndexFromFacts([
      wrapperFact({
        query: { persName: '範', originPlace: '陳郡' },
        entityId: 'entity-陳郡範',
      }),
      wrapperFact({
        query: { persName: '範', originPlace: '汝南' },
        entityId: 'entity-汝南範',
      }),
    ]);
    expect(index.resolve({ persName: '範', originPlace: '陳郡' })).toEqual(['entity-陳郡範']);
    expect(index.resolve({ persName: '範', originPlace: '汝南' })).toEqual(['entity-汝南範']);
    expect(index.resolve({ persName: '範' }).sort()).toEqual(
      ['entity-汝南範', 'entity-陳郡範'].sort(),
    );
  });

  it('returns nothing for a combination never harvested', () => {
    const index = buildWrapperDisambiguationIndexFromFacts([wrapperFact()]);
    expect(index.resolve({ persName: '未知' })).toEqual([]);
  });
});

describe('wrapperIdentityElement / wrapperDisambiguationQueryFromElement', () => {
  it('reads every slot off a fully populated wrapper', () => {
    const wrapper = parseWrapper(
      '<name type="personWrapper" cert="unknown">' +
        '<nationality>晉</nationality>' +
        '<roleName>刺史</roleName>' +
        '<nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle>' +
        '<placeName>陳郡</placeName>' +
        '<persName>範</persName>' +
        '</name>',
    );

    expect(wrapperIdentityElement(wrapper)?.textContent).toBe('範');
    expect(wrapperDisambiguationQueryFromElement(wrapper)).toEqual({
      persName: '範',
      dynasty: '晉',
      officeName: '刺史',
      originPlace: '陳郡',
      nobleTitle: { fief: '鄱陽', roleName: '王' },
    });
  });

  it('omits absent slots rather than including them as empty strings', () => {
    const wrapper = parseWrapper(
      '<name type="personWrapper" cert="unknown"><roleName>刺史</roleName><persName>範</persName></name>',
    );
    expect(wrapperDisambiguationQueryFromElement(wrapper)).toEqual({
      persName: '範',
      officeName: '刺史',
    });
  });

  it('returns null when the wrapper has no identity persName', () => {
    const wrapper = parseWrapper(
      '<name type="personWrapper" cert="unknown"><roleName>刺史</roleName></name>',
    );
    expect(wrapperIdentityElement(wrapper)).toBeNull();
    expect(wrapperDisambiguationQueryFromElement(wrapper)).toBeNull();
  });

  it('does not mistake a nested posthumous-name persName for the identity', () => {
    const wrapper = parseWrapper(
      '<name type="personWrapper" cert="unknown">' +
        '<nobleTitle><placeName>魏</placeName><persName type="posthumous">武</persName><roleName>帝</roleName></nobleTitle>' +
        '<persName>曹操</persName>' +
        '</name>',
    );
    expect(wrapperIdentityElement(wrapper)?.textContent).toBe('曹操');
    expect(wrapperDisambiguationQueryFromElement(wrapper)?.persName).toBe('曹操');
  });
});
