import {
  countTagsInXml,
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

describe('mergeFileCountsIntoProject', () => {
  test('replaces per-file counts and updates project totals', () => {
    const stats = mergeFileCountsIntoProject(emptyStats(), 'docs/a.xml', { p: 2, persName: 1 });
    expect(stats.files['docs/a.xml']?.tags).toEqual({ p: 2, persName: 1 });
    expect(stats.project.tags).toEqual({ p: 2, persName: 1 });

    const updated = mergeFileCountsIntoProject(stats, 'docs/a.xml', { p: 3, persName: 1 });
    expect(updated.project.tags).toEqual({ p: 3, persName: 1 });
  });
});
