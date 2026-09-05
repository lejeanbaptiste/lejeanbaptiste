import { assignEntity, markUnresolved } from './apply';
import * as anchorModule from './anchor';
import { collectMentions, mergeMentionGroups, purgeEntityKeys } from './mentions';

const XML = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p><persName key="p000001">張衡</persName> and <persName cert="unknown">張衡</persName> and <persName>洛陽</persName></p>
</body></text></TEI>`;

describe('mentions', () => {
  const doc = () => new DOMParser().parseFromString(XML, 'application/xml');

  it('skips keyed mentions by default', () => {
    const groups = collectMentions(doc(), 'ignore');
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => !group.fullyResolved)).toBe(true);
  });

  it('re-queues cert=unknown mentions without keys', () => {
    const groups = collectMentions(doc(), 'ignore');
    const unknown = groups.find((group) => group.surface === '張衡');
    expect(unknown?.instances.some((instance) => instance.isUnresolved)).toBe(true);
  });

  it('merges groups across documents', () => {
    const first = collectMentions(doc(), 'ignore', 'a');
    const second = collectMentions(doc(), 'ignore', 'b');
    const merged = mergeMentionGroups([...first, ...second]);
    const zhang = merged.find((group) => group.surface === '張衡');
    expect(zhang?.instances).toHaveLength(2);
  });

  it('purges @key only', () => {
    const document = doc();
    expect(purgeEntityKeys(document)).toBe(1);
    expect(document.querySelector('persName[key]')).toBeNull();
    expect(document.querySelectorAll('persName')).toHaveLength(3);
  });

  it('builds the document index only once per collectMentions call', () => {
    const buildSpy = jest.spyOn(anchorModule, 'buildDocIndex');
    try {
      collectMentions(doc(), 'ignore');
      expect(buildSpy).toHaveBeenCalledTimes(1);
    } finally {
      buildSpy.mockRestore();
    }
  });

  it('excludes sic/surplus text from the mention surface', () => {
    const document = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><persName><choice><sic>張</sic><corr>章</corr></choice>衡</persName></p></body></text></TEI>',
      'application/xml',
    );
    const groups = collectMentions(document, 'ignore');
    expect(groups.map((group) => group.surface)).toEqual(['章衡']);
  });

  it('includes personWrapper and roleName in validation mentions', () => {
    const document = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><name type="personWrapper"><roleName>合州刺史</roleName><persName>範</persName></name><roleName cert="unknown">太守</roleName></p></body></text></TEI>',
      'application/xml',
    );
    const groups = collectMentions(document, 'ignore');
    expect(groups.map((group) => group.tag)).toEqual(expect.arrayContaining(['name', 'roleName']));
    expect(groups.find((group) => group.tag === 'name')?.surface).toBe('合州刺史範');
  });

  it('excludes nobleTitle ranks and posthumous names from Disambiguate', () => {
    const document = new DOMParser().parseFromString(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>
        <nobleTitle><placeName>貞陽</placeName><roleName>公</roleName><persName type="posthumous">武</persName></nobleTitle>
        <persName>柳世隆</persName>
      </p></body></text></TEI>`,
      'application/xml',
    );
    const groups = collectMentions(document, 'ignore');
    expect(groups.map((group) => `${group.tag}:${group.surface}`).sort()).toEqual([
      'persName:柳世隆',
      'placeName:貞陽',
    ]);
  });

  it('ignores entity tags inside teiHeader', () => {
    const document = new DOMParser().parseFromString(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0">
        <teiHeader>
          <fileDesc>
            <titleStmt><title><persName>沈攸之</persName></title></titleStmt>
          </fileDesc>
        </teiHeader>
        <text><body><p><persName>張衡</persName></p></body></text>
      </TEI>`,
      'application/xml',
    );
    const groups = collectMentions(document, 'ignore');
    expect(groups.map((group) => group.surface)).toEqual(['張衡']);
  });

  it('does not purge @key from teiHeader entities', () => {
    const document = new DOMParser().parseFromString(
      `<TEI xmlns="http://www.tei-c.org/ns/1.0">
        <teiHeader>
          <fileDesc>
            <titleStmt><title><persName key="header-person">沈攸之</persName></title></titleStmt>
          </fileDesc>
        </teiHeader>
        <text><body><p><persName key="body-person">張衡</persName></p></body></text>
      </TEI>`,
      'application/xml',
    );
    expect(purgeEntityKeys(document)).toBe(1);
    expect(document.querySelector('teiHeader persName')?.getAttribute('key')).toBe('header-person');
    expect(document.querySelector('text persName')?.getAttribute('key')).toBeNull();
  });
});

describe('entity apply', () => {
  it('assigns @key and clears cert', () => {
    const document = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><persName cert="unknown">Test</persName></TEI>',
      'application/xml',
    );
    const element = document.documentElement.firstElementChild as Element;
    assignEntity({ element, entityId: 'person-000001', resp: '#grognard-autotag' });
    expect(element.getAttribute('key')).toBe('person-000001');
    expect(element.getAttribute('cert')).toBeNull();
    expect(element.getAttribute('resp')).toBe('#grognard-autotag');
  });

  it('marks unresolved without removing the tag', () => {
    const document = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><persName key="person-000001">Test</persName></TEI>',
      'application/xml',
    );
    const element = document.documentElement.firstElementChild as Element;
    markUnresolved(element);
    expect(element.getAttribute('key')).toBeNull();
    expect(element.getAttribute('cert')).toBe('unknown');
    expect(element.nodeName).toBe('persName');
  });
});
