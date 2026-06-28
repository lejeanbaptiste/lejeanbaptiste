import { buildOrlandoSkeletonXml, buildTeiSkeletonXml } from './schemaTemplates';
import { DESKTOP_APP_DISPLAY_NAME, DESKTOP_APP_IDENT } from './desktopBranding';
import { stampLastEditedInXml } from './revisionDescXml';

describe('stampLastEditedInXml', () => {
  test('adds Le Jean-Baptiste application stamp to TEI skeleton', () => {
    const xml = buildTeiSkeletonXml({
      schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
    });

    const stamped = stampLastEditedInXml(xml, {
      catalogId: 'teiLite',
      encoderName: 'Ada Lovelace',
      savedAt: new Date('2026-06-28T15:00:00.000Z'),
    });

    expect(stamped).toContain('<encodingDesc>');
    expect(stamped).toContain(`<application ident="${DESKTOP_APP_IDENT}"`);
    expect(stamped).toContain('<name>Ada Lovelace</name>');
    expect(stamped).toContain('when="2026-06-28"');
    expect(stamped).not.toContain('<revisionDesc>');
  });

  test('updates the same application entry on re-save', () => {
    const xml = stampLastEditedInXml(
      buildTeiSkeletonXml({
        schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
      }),
      {
        catalogId: 'teiLite',
        encoderName: 'First',
        savedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    );

    const restamped = stampLastEditedInXml(xml, {
      catalogId: 'teiLite',
      encoderName: 'Second',
      savedAt: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(restamped).toContain('<name>Second</name>');
    expect(restamped).toContain('when="2026-06-28"');
    expect(restamped).not.toContain('<name>First</name>');
    expect((restamped.match(new RegExp(`ident="${DESKTOP_APP_IDENT}"`, 'g')) ?? []).length).toBe(1);
  });

  test('does not modify existing revisionDesc history', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc><titleStmt><title>CBETA sample</title></titleStmt></fileDesc>
    <revisionDesc>
      <change when="2013-05-20">
        <name>CW</name>P4 to P5 conversion
      </change>
      <change when="2011-02-15T16:45:38">Created initial TEI XML version</change>
    </revisionDesc>
  </teiHeader>
  <text><body><p>Body</p></body></text>
</TEI>`;

    const stamped = stampLastEditedInXml(xml, {
      catalogId: null,
      encoderName: 'Potato',
      savedAt: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(stamped).toContain('P4 to P5 conversion');
    expect(stamped).toContain('Created initial TEI XML version');
    expect(stamped).toContain(`<application ident="${DESKTOP_APP_IDENT}"`);
    expect(stamped).toContain('<name>Potato</name>');
    expect(stamped).not.toContain('Last saved');
  });

  test('adds Le Jean-Baptiste responsibility without changing other revision entries', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENTRY>
<ORLANDOHEADER>
  <FILEDESC><TITLESTMT><DOCTITLE>Sample</DOCTITLE></TITLESTMT></FILEDESC>
  <REVISIONDESC>
    <RESPONSIBILITY RESP="IMG" WORKSTATUS="SUB" WORKVALUE="I">
      <DATE>2013</DATE>
    </RESPONSIBILITY>
  </REVISIONDESC>
</ORLANDOHEADER>
</ENTRY>`;

    const stamped = stampLastEditedInXml(xml, {
      catalogId: 'orlando',
      encoderName: 'Potato',
      savedAt: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(stamped).toContain('RESP="IMG"');
    expect(stamped).toContain('<DATE>2013</DATE>');
    expect(stamped).toContain(`RESP="${DESKTOP_APP_DISPLAY_NAME}"`);
    expect(stamped).toContain('when="2026-06-28"');
    expect(stamped).toContain('>Potato</DATE>');
  });

  test('updates Le Jean-Baptiste responsibility on re-save', () => {
    const xml = buildOrlandoSkeletonXml({
      schema: { catalogId: 'orlando', rng: 'schema/orlando_entry.rng', css: 'schema/orlando.css' },
    });

    const stamped = stampLastEditedInXml(xml, {
      catalogId: 'orlando',
      encoderName: 'First',
      savedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const restamped = stampLastEditedInXml(stamped, {
      catalogId: 'orlando',
      encoderName: 'Second',
      savedAt: new Date('2026-06-28T00:00:00.000Z'),
    });

    expect(restamped).toContain(`RESP="${DESKTOP_APP_DISPLAY_NAME}"`);
    expect(restamped).toContain('>Second</DATE>');
    expect(restamped).not.toContain('>First</DATE>');
  });

  test('leaves non-TEI XML unchanged', () => {
    const xml = '<root><item>plain</item></root>';
    expect(stampLastEditedInXml(xml, { catalogId: 'teiLite' })).toBe(xml);
  });
});
