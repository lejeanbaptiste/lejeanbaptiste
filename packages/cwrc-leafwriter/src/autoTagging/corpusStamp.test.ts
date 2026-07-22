import { PROJECT_DB_IDNO_TYPE, readProjectStamp, stampProjectDatabase } from './corpusStamp';

const withHeader = (extra = '') => `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt><title>Chapter 1</title></titleStmt>
      <publicationStmt><p>Unpublished.</p>${extra}</publicationStmt>
      <sourceDesc><p>Born digital.</p></sourceDesc>
    </fileDesc>
  </teiHeader>
  <text><body><p>張衡居洛陽。</p></body></text>
</TEI>`;

describe('corpus PEDB stamp', () => {
  it('reads null when unstamped', () => {
    expect(readProjectStamp(withHeader())).toBeNull();
  });

  it('inserts a stamp into publicationStmt', () => {
    const { xml, changed, skipped } = stampProjectDatabase(withHeader(), 'pedb-123');
    expect(changed).toBe(true);
    expect(skipped).toBe(false);
    expect(readProjectStamp(xml)).toBe('pedb-123');
    // the body is untouched (format-preserving)
    expect(xml).toContain('<text><body><p>張衡居洛陽。</p></body></text>');
  });

  it('is idempotent when the stamp already matches', () => {
    const once = stampProjectDatabase(withHeader(), 'pedb-123').xml;
    const twice = stampProjectDatabase(once, 'pedb-123');
    expect(twice.changed).toBe(false);
    expect(twice.xml).toBe(once);
  });

  it('replaces a stamp that names a different PEDB (misfiled file)', () => {
    const stamped = withHeader(`<idno type="${PROJECT_DB_IDNO_TYPE}">other-pedb</idno>`);
    const { xml, changed } = stampProjectDatabase(stamped, 'pedb-123');
    expect(changed).toBe(true);
    expect(readProjectStamp(xml)).toBe('pedb-123');
    expect((xml.match(/ljb-project-database/g) ?? []).length).toBe(1);
  });

  it('skips files with no publicationStmt rather than corrupting them', () => {
    const noHeader = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>x</p></body></text></TEI>';
    const { xml, changed, skipped } = stampProjectDatabase(noHeader, 'pedb-123');
    expect(skipped).toBe(true);
    expect(changed).toBe(false);
    expect(xml).toBe(noHeader);
  });
});
