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
    expect(zhang?.instances).toHaveLength(4);
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
});

describe('entity apply', () => {
  it('assigns @key and clears cert', () => {
    const document = new DOMParser().parseFromString(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><persName cert="unknown">Test</persName></TEI>',
      'application/xml',
    );
    const element = document.documentElement.firstElementChild as Element;
    assignEntity({ element, entityId: 'person-000001', resp: '#ljb-autotag' });
    expect(element.getAttribute('key')).toBe('person-000001');
    expect(element.getAttribute('cert')).toBeNull();
    expect(element.getAttribute('resp')).toBe('#ljb-autotag');
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
