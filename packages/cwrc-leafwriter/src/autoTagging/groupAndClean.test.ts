import {
  assignPersonWrapperKeys,
  buildOfficeIndex,
  createPersonWrappersInScope,
  mergeAdjacentRoleNames,
  parseChildlessNobleTitles,
  rollPlaceIntoRole,
  runGroupAndClean,
} from './groupAndClean';
import { buildNobleTitleVocabulary } from './nobleTitleSpanParser';
import type { AuthorityCandidate } from './authority';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc);

const TEI_OPEN = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>';
const TEI_CLOSE = '</body></text></TEI>';

const officeCandidate = (
  name: string,
  metadata: NonNullable<AuthorityCandidate['metadata']>,
): AuthorityCandidate => ({
  source: 'norbert-offices',
  authorityId: name,
  kind: 'office',
  primaryName: name,
  searchStrings: [name],
  metadata,
});

describe('mergeAdjacentRoleNames', () => {
  it('merges 尚書 + 吏部 when the office pack marks 吏部 as follows-office', () => {
    const doc = parse(
      `${TEI_OPEN}<p><roleName>尚書</roleName><roleName>吏部</roleName></p>${TEI_CLOSE}`,
    );
    const officeIndex = buildOfficeIndex([officeCandidate('吏部', { followsOffice: true })]);
    const touched = new Set<Element>();
    const merged = mergeAdjacentRoleNames(doc.documentElement, officeIndex, touched);

    expect(merged).toBe(1);
    expect(doc.getElementsByTagName('roleName').length).toBe(1);
    expect(doc.getElementsByTagName('roleName')[0]!.textContent).toBe('尚書吏部');
    expect(touched.size).toBe(1);
  });

  it('leaves adjacent roleNames alone when neither follows an office', () => {
    const doc = parse(
      `${TEI_OPEN}<p><roleName>尚書</roleName><roleName>吏部</roleName></p>${TEI_CLOSE}`,
    );
    const officeIndex = buildOfficeIndex([officeCandidate('吏部', {})]);
    const merged = mergeAdjacentRoleNames(doc.documentElement, officeIndex, new Set());

    expect(merged).toBe(0);
    expect(doc.getElementsByTagName('roleName').length).toBe(2);
  });
});

describe('rollPlaceIntoRole', () => {
  it('nests 荊州 inside 刺史 when the office pack marks 刺史 as follows-place', () => {
    const doc = parse(
      `${TEI_OPEN}<p><placeName>荊州</placeName><roleName>刺史</roleName></p>${TEI_CLOSE}`,
    );
    const officeIndex = buildOfficeIndex([officeCandidate('刺史', { followsPlace: true })]);
    const touched = new Set<Element>();
    const rolled = rollPlaceIntoRole(doc.documentElement, officeIndex, touched);

    expect(rolled).toBe(1);
    expect(serialize(doc)).toContain(
      '<roleName><placeName>荊州</placeName>刺史</roleName>',
    );
    expect(doc.getElementsByTagName('placeName').length).toBe(1);
    expect(touched.size).toBe(1);
  });
});

describe('parseChildlessNobleTitles', () => {
  it('decomposes a flat nobleTitle into structured children', () => {
    const doc = parse(`${TEI_OPEN}<p><nobleTitle>魏武帝</nobleTitle></p>${TEI_CLOSE}`);
    const vocabulary = buildNobleTitleVocabulary([]);
    const touched = new Set<Element>();
    const parsed = parseChildlessNobleTitles(doc.documentElement, vocabulary, touched);

    const title = doc.getElementsByTagName('nobleTitle')[0]!;
    expect(parsed).toBe(1);
    expect(title.children.length).toBeGreaterThan(0);
    expect(touched.has(title)).toBe(true);
  });

  it('leaves a nobleTitle with existing children untouched', () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><roleName>王</roleName></nobleTitle></p>${TEI_CLOSE}`,
    );
    const vocabulary = buildNobleTitleVocabulary([]);
    const parsed = parseChildlessNobleTitles(doc.documentElement, vocabulary, new Set());
    expect(parsed).toBe(0);
  });
});

describe('createPersonWrappersInScope', () => {
  it('wraps a roleName immediately preceding a persName', () => {
    const doc = parse(
      `${TEI_OPEN}<p><roleName>領軍將軍</roleName><persName key="p1">李安民</persName>等破虜</p>${TEI_CLOSE}`,
    );
    const touched = new Set<Element>();
    const created = createPersonWrappersInScope(doc.documentElement, touched);

    expect(created).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(wrapper.getAttribute('type')).toBe('personWrapper');
    expect(wrapper.children.length).toBe(2);
    expect(wrapper.children[0]!.tagName).toBe('roleName');
    expect(wrapper.children[1]!.tagName).toBe('persName');
    // The trailing, unrelated text ("等破虜") must stay outside the wrapper.
    expect(wrapper.nextSibling?.textContent).toBe('等破虜');
    expect(touched.has(wrapper)).toBe(true);
  });

  it('wraps a nobleTitle immediately preceding a persName', () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><placeName>貞陽</placeName>公</nobleTitle><persName key="p2">柳世隆</persName>為</p>${TEI_CLOSE}`,
    );
    const created = createPersonWrappersInScope(doc.documentElement, new Set());

    expect(created).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(wrapper.children[0]!.tagName).toBe('nobleTitle');
    expect(wrapper.children[1]!.tagName).toBe('persName');
  });

  it('leaves a lone persName with no preceding component untouched', () => {
    const doc = parse(`${TEI_OPEN}<p>皇子<persName key="p3">鋒</persName>為</p>${TEI_CLOSE}`);
    const created = createPersonWrappersInScope(doc.documentElement, new Set());

    expect(created).toBe(0);
    expect(doc.getElementsByTagName('name').length).toBe(0);
  });

  it('never pulls a component that follows the persName into the wrapper', () => {
    const doc = parse(
      `${TEI_OPEN}<p><roleName>南兖州刺史</roleName><persName key="p4">柳世隆</persName><roleName>不相關</roleName></p>${TEI_CLOSE}`,
    );
    const created = createPersonWrappersInScope(doc.documentElement, new Set());

    expect(created).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(wrapper.children.length).toBe(2);
    expect(wrapper.nextElementSibling?.textContent).toBe('不相關');
  });

  it('does not re-wrap a persName already inside a personWrapper', () => {
    const doc = parse(
      `${TEI_OPEN}<p><name type="personWrapper" key="p5"><roleName>吏部尚書</roleName><persName>張行成</persName></name></p>${TEI_CLOSE}`,
    );
    const created = createPersonWrappersInScope(doc.documentElement, new Set());
    expect(created).toBe(0);
    expect(doc.getElementsByTagName('name').length).toBe(1);
  });
});

describe('runGroupAndClean (integration, user-reported case)', () => {
  it('merges/nests office tags and wraps every person in a real passage', () => {
    const xml = `${TEI_OPEN}<p>詔王公<roleName key="office-9">卿士</roleName>薦讜言。以<roleName key="office-1">平北將軍</roleName><persName key="person-1">陳顯達</persName>為<placeName>益州</placeName><roleName key="office-2">刺史</roleName>，<nobleTitle><roleName><placeName>貞陽</placeName>公</roleName></nobleTitle><persName key="person-2">柳世隆</persName>為<roleName key="office-3">南兖州刺史</roleName>，皇子<persName key="person-3">鋒</persName>為<nobleTitle><roleName><placeName>江夏</placeName>王</roleName></nobleTitle>。<roleName key="office-4">領軍將軍</roleName><persName key="person-4">李安民</persName>等破虜於<placeName>淮陽</placeName>。</p>${TEI_CLOSE}`;
    const doc = parse(xml);
    const entitiesDoc = parse('<TEI xmlns="http://www.tei-c.org/ns/1.0"/>');
    const officeCandidates: AuthorityCandidate[] = [];
    const vocabulary = buildNobleTitleVocabulary([]);

    const result = runGroupAndClean(entitiesDoc, doc.documentElement, officeCandidates, vocabulary);

    expect(result.createdWrappers).toBe(3);
    const wrappers = Array.from(doc.getElementsByTagName('name')).filter(
      (el) => el.getAttribute('type') === 'personWrapper',
    );
    expect(wrappers.length).toBe(3);
    // Each wrapper's key was copied straight down from its already-keyed persName.
    expect(wrappers.map((w) => w.getAttribute('key')).sort()).toEqual([
      'person-1',
      'person-2',
      'person-4',
    ]);
    // The lone name (鋒, no preceding role/place/title) stays unwrapped.
    expect(doc.getElementsByTagName('persName').length).toBe(4);
    const loneName = Array.from(doc.getElementsByTagName('persName')).find(
      (el) => el.textContent === '鋒',
    );
    expect(loneName?.parentElement?.getAttribute('type')).not.toBe('personWrapper');
  });
});

describe('assignPersonWrapperKeys', () => {
  it('copies an already-keyed persName key up to its keyless wrapper', () => {
    const doc = parse(
      `${TEI_OPEN}<p><name type="personWrapper" cert="unknown"><persName key="p1">張行成</persName></name></p>${TEI_CLOSE}`,
    );
    const entitiesDoc = parse('<TEI xmlns="http://www.tei-c.org/ns/1.0"/>');
    const touched = new Set<Element>();
    const result = assignPersonWrapperKeys(doc.documentElement, entitiesDoc, touched);

    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(result.copied).toBe(1);
    expect(wrapper.getAttribute('key')).toBe('p1');
    expect(wrapper.getAttribute('cert')).toBeNull();
    expect(touched.has(wrapper)).toBe(true);
  });

  it('leaves an unresolvable wrapper pending rather than blocking', () => {
    const doc = parse(
      `${TEI_OPEN}<p><name type="personWrapper" cert="unknown"><persName>無名氏</persName></name></p>${TEI_CLOSE}`,
    );
    const entitiesDoc = parse('<TEI xmlns="http://www.tei-c.org/ns/1.0"/>');
    const result = assignPersonWrapperKeys(doc.documentElement, entitiesDoc, new Set());

    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(result.copied).toBe(0);
    expect(wrapper.getAttribute('key')).toBeNull();
    expect(wrapper.getAttribute('cert')).toBe('unknown');
  });
});
