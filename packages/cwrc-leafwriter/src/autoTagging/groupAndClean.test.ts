import {
  assignPersonWrapperKeys,
  buildOfficeIndex,
  createPersonWrappersInScope,
  mergeAdjacentRoleNames,
  parseChildlessNobleTitles,
  reparseApprovedNobleTitleNames,
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

  it('does not merge roleNames that sit inside a nobleTitle', () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><roleName>尚書</roleName><roleName>吏部</roleName></nobleTitle></p>${TEI_CLOSE}`,
    );
    const officeIndex = buildOfficeIndex([officeCandidate('吏部', { followsOffice: true })]);
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
    expect(serialize(doc)).toContain('<roleName><placeName>荊州</placeName>刺史</roleName>');
    expect(doc.getElementsByTagName('placeName').length).toBe(1);
    expect(touched.size).toBe(1);
  });

  it('leaves placeName + roleName siblings inside nobleTitle alone', () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><placeName>貞陽</placeName><roleName>公</roleName></nobleTitle></p>${TEI_CLOSE}`,
    );
    // 公 may also exist as an office with followsPlace — that must not rewrite titles.
    const officeIndex = buildOfficeIndex([officeCandidate('公', { followsPlace: true })]);
    const rolled = rollPlaceIntoRole(doc.documentElement, officeIndex, new Set());

    expect(rolled).toBe(0);
    expect(serialize(doc)).toContain(
      '<nobleTitle><placeName>貞陽</placeName><roleName>公</roleName></nobleTitle>',
    );
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
    // No trailing name in "魏武帝" (fief+posthumous+role only) — the title
    // still gets wrapped, with an empty, keyless identity persName so it can
    // enter Disambiguate as a fief+role candidate list.
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(wrapper.getAttribute('type')).toBe('personWrapper');
    expect(wrapper.getElementsByTagName('nobleTitle')[0]).toBe(title);
    const identity = Array.from(wrapper.children).find((child) => child.tagName === 'persName')!;
    expect(identity.textContent).toBe('');
    expect(identity.getAttribute('key')).toBeNull();
    expect(touched.has(wrapper)).toBe(true);
  });

  it('leaves a nobleTitle with existing children untouched', () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><roleName>王</roleName></nobleTitle></p>${TEI_CLOSE}`,
    );
    const vocabulary = buildNobleTitleVocabulary([]);
    const parsed = parseChildlessNobleTitles(doc.documentElement, vocabulary, new Set());
    expect(parsed).toBe(0);
  });

  it('wraps an already-structured standalone nobleTitle with no attached name', () => {
    // Produced directly by tag-bombing/wrapper-candidate suggestions with
    // placeName+roleName children already in place — not flat text — and
    // no name attached at all (e.g. 南陽王薨 with no preceding persName).
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><placeName>南陽</placeName><roleName ref="NORBERT:office-1311">王</roleName></nobleTitle>薨</p>${TEI_CLOSE}`,
    );
    const vocabulary = buildNobleTitleVocabulary([]);
    const touched = new Set<Element>();
    const parsed = parseChildlessNobleTitles(doc.documentElement, vocabulary, touched);

    expect(parsed).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(wrapper.getAttribute('type')).toBe('personWrapper');
    expect(wrapper.getElementsByTagName('nobleTitle').length).toBe(1);
    const identity = Array.from(wrapper.children).find((child) => child.tagName === 'persName')!;
    expect(identity.textContent).toBe('');
    expect(identity.getAttribute('key')).toBeNull();
    expect(touched.has(wrapper)).toBe(true);
  });

  it('does not wrap an already-structured nobleTitle when a real name follows', () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><placeName>貞陽</placeName><roleName>公</roleName></nobleTitle><persName key="p1">柳世隆</persName></p>${TEI_CLOSE}`,
    );
    const vocabulary = buildNobleTitleVocabulary([]);
    const touched = new Set<Element>();
    const parsed = parseChildlessNobleTitles(doc.documentElement, vocabulary, touched);

    expect(parsed).toBe(0);
    expect(doc.getElementsByTagName('name').length).toBe(0);
  });
});

describe('reparseApprovedNobleTitleNames', () => {
  it('replaces an exact reviewed persName with a structured nobleTitle', () => {
    const doc = parse(`${TEI_OPEN}<p><persName key="p1">海鹽公主</persName></p>${TEI_CLOSE}`);
    const candidate = {
      source: 'Noble title filter (Norbert)',
      authorityId: 'noble-title-filter:haiyan:person-1',
      kind: 'person' as const,
      primaryName: '海鹽公主',
      searchStrings: ['海鹽公主'],
      metadata: {
        isNobleTitle: true,
        nobleTitleFilter: { ruleId: 'haiyan' },
        nobleTitle: { fief: '海鹽', roleName: '公主' },
      },
    };
    const repaired = reparseApprovedNobleTitleNames(doc.documentElement, [candidate], new Set());
    expect(repaired).toBe(1);
    expect(serialize(doc)).toContain(
      '<nobleTitle><placeName>海鹽</placeName><roleName>公主</roleName></nobleTitle>',
    );
    expect(doc.getElementsByTagName('persName').length).toBe(0);
  });

  it('keeps the existing key on an approved title-plus-person wrapper', () => {
    const doc = parse(`${TEI_OPEN}<p><persName key="p2">壽王瑁</persName></p>${TEI_CLOSE}`);
    const candidate = {
      source: 'Noble title filter (Norbert)',
      authorityId: 'noble-title-filter:shou:person-2',
      kind: 'person' as const,
      primaryName: '壽王瑁',
      searchStrings: ['壽王瑁'],
      metadata: {
        isNobleTitle: true,
        nobleTitleFilter: { ruleId: 'shou' },
        nobleTitle: { fief: '壽', roleName: '王' },
        wrapper: {
          personId: 'person-2',
          titleRowId: 'shou',
          components: { fief: '壽', roleName: '王', persName: '瑁' },
        },
      },
    };
    const repaired = reparseApprovedNobleTitleNames(doc.documentElement, [candidate], new Set());
    expect(repaired).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(wrapper.getAttribute('key')).toBe('p2');
    expect(wrapper.getElementsByTagName('persName')[0]!.getAttribute('key')).toBe('p2');
    expect(wrapper.getElementsByTagName('persName')[0]!.textContent).toBe('瑁');
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

  it('wraps every leading slot present, in canonical order', () => {
    const doc = parse(
      `${TEI_OPEN}<p><nationality>晉</nationality><roleName>刺史</roleName><nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle><placeName>陳郡</placeName><persName key="p6">範</persName></p>${TEI_CLOSE}`,
    );
    const created = createPersonWrappersInScope(doc.documentElement, new Set());

    expect(created).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(Array.from(wrapper.children).map((el) => el.tagName)).toEqual([
      'nationality',
      'roleName',
      'nobleTitle',
      'placeName',
      'persName',
    ]);
  });

  it('stops at a placeName (origin) that sits before an out-of-order roleName', () => {
    // 陳郡 (origin placeName) then 刺史 (roleName) is backwards — roleName
    // must come before placeName in the canonical order — so the wrap must
    // stop at 刺史 and never reach across it to 陳郡.
    const doc = parse(
      `${TEI_OPEN}<p><placeName>陳郡</placeName><roleName>刺史</roleName><persName key="p7">範</persName></p>${TEI_CLOSE}`,
    );
    const created = createPersonWrappersInScope(doc.documentElement, new Set());

    expect(created).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(Array.from(wrapper.children).map((el) => el.tagName)).toEqual(['roleName', 'persName']);
    // The out-of-order placeName is left outside the wrapper, untouched.
    expect(wrapper.previousSibling?.textContent).toBe('陳郡');
  });

  it('stops at a nobleTitle that sits before an out-of-order placeName', () => {
    const doc = parse(
      `${TEI_OPEN}<p><nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle><roleName>刺史</roleName><persName key="p8">範</persName></p>${TEI_CLOSE}`,
    );
    const created = createPersonWrappersInScope(doc.documentElement, new Set());

    expect(created).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(Array.from(wrapper.children).map((el) => el.tagName)).toEqual(['roleName', 'persName']);
    expect(wrapper.previousSibling?.textContent).toBe('鄱陽王');
  });

  it('wraps two adjacent components of the same slot type together', () => {
    const doc = parse(
      `${TEI_OPEN}<p><placeName>陳郡</placeName><placeName>陽夏</placeName><persName key="p9">範</persName></p>${TEI_CLOSE}`,
    );
    const created = createPersonWrappersInScope(doc.documentElement, new Set());

    expect(created).toBe(1);
    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(Array.from(wrapper.children).map((el) => el.tagName)).toEqual([
      'placeName',
      'placeName',
      'persName',
    ]);
  });
});

describe('runGroupAndClean (integration, user-reported case)', () => {
  it('merges/nests office tags and wraps every person in a real passage', async () => {
    // Noble titles use sibling placeName + roleName (not office-style nesting).
    const xml = `${TEI_OPEN}<p>詔王公<roleName key="office-9">卿士</roleName>薦讜言。以<roleName key="office-1">平北將軍</roleName><persName key="person-1">陳顯達</persName>為<placeName>益州</placeName><roleName key="office-2">刺史</roleName>，<nobleTitle><placeName>貞陽</placeName><roleName>公</roleName></nobleTitle><persName key="person-2">柳世隆</persName>為<roleName key="office-3">南兖州刺史</roleName>，皇子<persName key="person-3">鋒</persName>為<nobleTitle><placeName>江夏</placeName><roleName>王</roleName></nobleTitle>。<roleName key="office-4">領軍將軍</roleName><persName key="person-4">李安民</persName>等破虜於<placeName>淮陽</placeName>。</p>${TEI_CLOSE}`;
    const doc = parse(xml);
    // 公 / 王 may also be offices with followsPlace — must not rewrite titles.
    const officeCandidates: AuthorityCandidate[] = [
      officeCandidate('刺史', { followsPlace: true }),
      officeCandidate('公', { followsPlace: true }),
      officeCandidate('王', { followsPlace: true }),
    ];
    const vocabulary = buildNobleTitleVocabulary([]);

    const result = await runGroupAndClean(
      async () => [],
      doc.documentElement,
      officeCandidates,
      vocabulary,
    );

    expect(result.rolledPlaceNames).toBe(1); // only 益州 + 刺史
    expect(result.createdWrappers).toBe(3);
    // 江夏王 has no attached name at all — it gets its own bare wrapper with
    // an empty, keyless identity persName (see parseChildlessNobleTitles),
    // counted separately under parsedNobleTitles, not createdWrappers.
    expect(result.parsedNobleTitles).toBe(1);
    const wrappers = Array.from(doc.getElementsByTagName('name')).filter(
      (el) => el.getAttribute('type') === 'personWrapper',
    );
    expect(wrappers.length).toBe(4);
    // Each named wrapper's key was copied straight down from its already-keyed persName;
    // the bare 江夏王 wrapper stays keyless for Disambiguate to pick up.
    expect(wrappers.map((w) => w.getAttribute('key')).sort()).toEqual([
      null,
      'person-1',
      'person-2',
      'person-4',
    ]);
    // Title fief + rank stay siblings under nobleTitle.
    expect(serialize(doc)).toContain(
      '<nobleTitle><placeName>貞陽</placeName><roleName>公</roleName></nobleTitle>',
    );
    expect(serialize(doc)).toContain(
      '<name type="personWrapper" cert="unknown"><nobleTitle><placeName>江夏</placeName><roleName>王</roleName></nobleTitle><persName/></name>',
    );
    // The lone name (鋒, no preceding role/place/title) stays unwrapped.
    expect(doc.getElementsByTagName('persName').length).toBe(5);
    const loneName = Array.from(doc.getElementsByTagName('persName')).find(
      (el) => el.textContent === '鋒',
    );
    expect(loneName?.parentElement?.getAttribute('type')).not.toBe('personWrapper');
  });
});

describe('assignPersonWrapperKeys', () => {
  it('copies an already-keyed persName key up to its keyless wrapper', async () => {
    const doc = parse(
      `${TEI_OPEN}<p><name type="personWrapper" cert="unknown"><persName key="p1">張行成</persName></name></p>${TEI_CLOSE}`,
    );
    const touched = new Set<Element>();
    const result = await assignPersonWrapperKeys(doc.documentElement, async () => [], touched);

    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(result.copied).toBe(1);
    expect(wrapper.getAttribute('key')).toBe('p1');
    expect(wrapper.getAttribute('cert')).toBeNull();
    expect(touched.has(wrapper)).toBe(true);
  });

  it('leaves an unresolvable wrapper pending rather than blocking', async () => {
    const doc = parse(
      `${TEI_OPEN}<p><name type="personWrapper" cert="unknown"><persName>無名氏</persName></name></p>${TEI_CLOSE}`,
    );
    const result = await assignPersonWrapperKeys(doc.documentElement, async () => [], new Set());

    const wrapper = doc.getElementsByTagName('name')[0]!;
    expect(result.copied).toBe(0);
    expect(wrapper.getAttribute('key')).toBeNull();
    expect(wrapper.getAttribute('cert')).toBe('unknown');
  });
});
