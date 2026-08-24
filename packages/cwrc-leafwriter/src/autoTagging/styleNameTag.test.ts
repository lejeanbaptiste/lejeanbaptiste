import { tagFollowingStyleNames } from './styleNameTag';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

describe('tagFollowingStyleNames', () => {
  it('tags a one- or two-character 字 name with the original key', () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><p><persName key="p1">王安石</persName>字介甫，居京</p></TEI>',
    );

    expect(tagFollowingStyleNames(doc)).toBe(1);
    expect(doc.querySelectorAll('persName')).toHaveLength(2);
    expect(doc.querySelectorAll('persName')[1]?.textContent).toBe('介甫');
    expect(doc.querySelectorAll('persName')[1]?.getAttribute('type')).toBe('courtesy');
    expect(doc.querySelectorAll('persName')[1]?.getAttribute('key')).toBe('p1');
    expect(doc.documentElement.textContent).toContain('字');
    expect(doc.documentElement.textContent).toContain('，居京');
  });

  it('requires the punctuation and an immediate text-node suffix', () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><p><persName key="p1">王安石</persName>字介甫居京</p></TEI>',
    );
    expect(tagFollowingStyleNames(doc)).toBe(0);
  });
});
