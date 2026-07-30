import {
  assignPersonWrapperKeys,
  buildOfficeIndex,
  mergeAdjacentRoleNames,
  parseChildlessNobleTitles,
  rollPlaceIntoRole,
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
