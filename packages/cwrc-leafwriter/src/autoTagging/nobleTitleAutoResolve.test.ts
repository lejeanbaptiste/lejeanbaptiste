import {
  autoResolveNobleTitles,
  bareNobleTitleQuery,
  buildPackTitleNorbertIndex,
  buildPersonTitleIndex,
  buildTitleOnlyPersonIndex,
  nobleTitleMatchKey,
  titleOnlyMatchKey,
} from './nobleTitleAutoResolve';
import { collectMentions } from './mentions';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const TEI_OPEN = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>';
const TEI_CLOSE = '</body></text></TEI>';

describe('collectMentions nobleTitle filter', () => {
  it('queues only the placeName inside a nobleTitle', () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><placeName>貞陽</placeName><roleName>公</roleName><persName type="posthumous">武</persName></nobleTitle><persName>柳世隆</persName></p>${TEI_CLOSE}`,
    );
    const groups = collectMentions(doc, 'ignore');
    const surfaces = groups.map((group) => `${group.tag}:${group.surface}`).sort();
    expect(surfaces).toEqual(['persName:柳世隆', 'placeName:貞陽']);
  });

  it('still queues free-floating roleNames outside nobleTitle', () => {
    const doc = parse(
      `${TEI_OPEN}<p><roleName>刺史</roleName><nobleTitle><placeName>江夏</placeName><roleName>王</roleName></nobleTitle></p>${TEI_CLOSE}`,
    );
    const groups = collectMentions(doc, 'ignore');
    expect(groups.map((group) => `${group.tag}:${group.surface}`).sort()).toEqual([
      'placeName:江夏',
      'roleName:刺史',
    ]);
  });
});

describe('nobleTitleAutoResolve', () => {
  it('indexes only titles that have place + role + posthumous', () => {
    const index = buildPersonTitleIndex([
      {
        id: 'person-1',
        nobleTitles: [
          { fief: '魏', roleName: '帝', posthumousName: '武' },
          { fief: '貞陽', roleName: '公' },
        ],
      },
    ]);
    expect(index.get(nobleTitleMatchKey('魏', '帝', '武'))).toEqual(['person-1']);
    expect(index.has(nobleTitleMatchKey('貞陽', '公', ''))).toBe(false);
  });

  it('auto-keys a unique closed-set rank to a local office', async () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><placeName>貞陽</placeName><roleName>公</roleName></nobleTitle></p>${TEI_CLOSE}`,
    );
    const result = await autoResolveNobleTitles(doc, {
      findOfficeIds: (rank) => (rank === '公' ? ['office-公'] : []),
      findPersonIdsByTitle: async () => [],
    });
    expect(result.resolvedRanks).toBe(1);
    expect(doc.getElementsByTagName('roleName')[0]!.getAttribute('key')).toBe('office-公');
  });

  it('sets a pack ref when no local office exists for the rank', async () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><placeName>江夏</placeName><roleName>王</roleName></nobleTitle></p>${TEI_CLOSE}`,
    );
    const result = await autoResolveNobleTitles(doc, {
      findOfficeIds: async () => [],
      findPackOfficeAuthority: (rank) => (rank === '王' ? 'NORBERT:office-1311' : null),
      findPersonIdsByTitle: async () => [],
    });
    expect(result.resolvedRankRefs).toBe(1);
    expect(doc.getElementsByTagName('roleName')[0]!.getAttribute('ref')).toBe(
      'NORBERT:office-1311',
    );
  });

  it('auto-keys person + wrapper for a unique place+role+posthumous title', async () => {
    const doc = parse(
      `${TEI_OPEN}<p><name type="personWrapper" cert="unknown"><nobleTitle><placeName>魏</placeName><persName type="posthumous">武</persName><roleName>帝</roleName></nobleTitle><persName>曹操</persName></name></p>${TEI_CLOSE}`,
    );
    const result = await autoResolveNobleTitles(doc, {
      findOfficeIds: async () => ['office-帝'],
      findPersonIdsByTitle: async ({ place, role, posthumous }) =>
        place === '魏' && role === '帝' && posthumous === '武' ? ['person-caocao'] : [],
    });
    expect(result.resolvedPersons).toBe(1);
    expect(result.resolvedRanks).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(wrapper.getAttribute('key')).toBe('person-caocao');
    expect(wrapper.getElementsByTagName('persName')[1]!.getAttribute('key')).toBe('person-caocao');
  });

  it('does not auto-resolve from posthumous alone', async () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><persName type="posthumous">武</persName><roleName>帝</roleName></nobleTitle><persName>曹操</persName></p>${TEI_CLOSE}`,
    );
    const result = await autoResolveNobleTitles(doc, {
      findOfficeIds: async () => [],
      findPersonIdsByTitle: async () => ['person-should-not-apply'],
    });
    expect(result.resolvedPersons).toBe(0);
    expect(doc.getElementsByTagName('persName')[1]!.getAttribute('key')).toBeNull();
  });

  it('indexes pack titles that carry a Norbert person id', () => {
    const index = buildPackTitleNorbertIndex([
      {
        metadata: {
          isNobleTitle: true,
          nobleTitle: { fief: '魏', roleName: '帝', posthumousName: '武' },
          wrapper: { personId: '12' },
        },
      },
    ]);
    expect(index.get(nobleTitleMatchKey('魏', '帝', '武'))).toEqual(['person-12']);
  });
});

describe('buildTitleOnlyPersonIndex', () => {
  it('indexes by fief+role alone, no posthumous name required', () => {
    const index = buildTitleOnlyPersonIndex([
      { id: 'p1', nobleTitles: [{ fief: '建安', roleName: '王' }] },
    ]);
    expect(index.get(titleOnlyMatchKey('建安', '王'))).toEqual(['p1']);
  });

  it('collects every person who held the same fief+role, across reigns', () => {
    const index = buildTitleOnlyPersonIndex([
      { id: 'p1', nobleTitles: [{ fief: '建安', roleName: '王' }] },
      { id: 'p2', nobleTitles: [{ fief: '建安', roleName: '王' }] },
    ]);
    expect(index.get(titleOnlyMatchKey('建安', '王'))?.sort()).toEqual(['p1', 'p2']);
  });

  it('skips a title missing fief or role', () => {
    const index = buildTitleOnlyPersonIndex([
      { id: 'p1', nobleTitles: [{ fief: '建安' }, { roleName: '王' }] },
    ]);
    expect(index.size).toBe(0);
  });
});

describe('bareNobleTitleQuery', () => {
  const parseWrapper = (xml: string): Element =>
    parse(`${TEI_OPEN}<p>${xml}</p>${TEI_CLOSE}`).getElementsByTagName('name')[0]!;

  it('reads fief+role from a wrapper whose identity persName is empty', () => {
    const wrapper = parseWrapper(
      '<name type="personWrapper" cert="unknown"><nobleTitle><placeName>建安</placeName><roleName>王</roleName></nobleTitle><persName/></name>',
    );
    expect(bareNobleTitleQuery(wrapper)).toEqual({ fief: '建安', roleName: '王' });
  });

  it('returns null when the wrapper already has a real name', () => {
    const wrapper = parseWrapper(
      '<name type="personWrapper" cert="unknown"><nobleTitle><placeName>建安</placeName><roleName>王</roleName></nobleTitle><persName>休仁</persName></name>',
    );
    expect(bareNobleTitleQuery(wrapper)).toBeNull();
  });

  it('returns null for a wrapper with no nobleTitle child', () => {
    const wrapper = parseWrapper(
      '<name type="personWrapper" cert="unknown"><roleName>刺史</roleName><persName/></name>',
    );
    expect(bareNobleTitleQuery(wrapper)).toBeNull();
  });

  it('returns null for a non-personWrapper element', () => {
    const wrapper = parse(
      `${TEI_OPEN}<p><placeName>建安</placeName></p>${TEI_CLOSE}`,
    ).getElementsByTagName('placeName')[0]!;
    expect(bareNobleTitleQuery(wrapper)).toBeNull();
  });
});
