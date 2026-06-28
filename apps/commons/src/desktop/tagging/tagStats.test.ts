import {
  countAttrsInXml,
  countTagsInXml,
  countUsageInXml,
  getAttrValueCounts,
  getProjectAttrCounts,
  mergeFileCountsIntoProject,
  type TagUsageStats,
} from './tagStats';

const emptyStats = (): TagUsageStats => ({
  version: 1,
  project: { tags: {}, attrs: {}, attrValues: {} },
  files: {},
});

describe('countTagsInXml', () => {
  test('counts element names in TEI XML', () => {
    const xml = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title/></titleStmt></fileDesc></teiHeader>
  <text><body><p>One</p><p>Two</p><persName>Ada</persName></body></text>
</TEI>`;

    expect(countTagsInXml(xml)).toEqual({
      TEI: 1,
      teiHeader: 1,
      fileDesc: 1,
      titleStmt: 1,
      title: 1,
      text: 1,
      body: 1,
      p: 2,
      persName: 1,
    });
  });
});

describe('countAttrsInXml', () => {
  test('counts attributes and values per element', () => {
    const xml = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body>
    <persName key="p1" ref="http://example.org/p1">Ada</persName>
    <persName key="p2" ref="http://example.org/p2">Bob</persName>
  </body></text>
</TEI>`;

    const { attrs, attrValues } = countAttrsInXml(xml);
    expect(attrs.persName).toEqual({ key: 2, ref: 2 });
    expect(attrValues.persName?.key).toEqual({ p1: 1, p2: 1 });
    expect(attrValues.persName?.ref).toMatchObject({
      'http://example.org/p1': 1,
      'http://example.org/p2': 1,
    });
  });

  test('skips reserved attribute names', () => {
    const xml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p id="x" _tag="p">Hi</p></body></text></TEI>`;
    expect(countAttrsInXml(xml).attrs.p).toBeUndefined();
  });
});

describe('mergeFileCountsIntoProject', () => {
  test('replaces per-file counts and updates project totals', () => {
    const stats = mergeFileCountsIntoProject(emptyStats(), 'docs/a.xml', {
      tags: { p: 2, persName: 1 },
      attrs: {},
      attrValues: {},
    });
    expect(stats.files['docs/a.xml']?.tags).toEqual({ p: 2, persName: 1 });
    expect(stats.project.tags).toEqual({ p: 2, persName: 1 });

    const updated = mergeFileCountsIntoProject(stats, 'docs/a.xml', {
      tags: { p: 3, persName: 1 },
      attrs: {},
      attrValues: {},
    });
    expect(updated.project.tags).toEqual({ p: 3, persName: 1 });
  });

  test('merges attribute counts across files', () => {
    const xml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><persName key="a">X</persName></body></text></TEI>`;
    const fileCounts = countUsageInXml(xml);
    const stats = mergeFileCountsIntoProject(emptyStats(), 'a.xml', fileCounts);

    expect(getProjectAttrCounts(stats, 'persName')).toEqual({ key: 1 });
    expect(getAttrValueCounts(stats, 'persName', 'key')).toEqual({ a: 1 });

    const updated = mergeFileCountsIntoProject(stats, 'a.xml', {
      tags: { persName: 0 },
      attrs: {},
      attrValues: {},
    });
    expect(getProjectAttrCounts(updated, 'persName')).toEqual({});
  });
});
