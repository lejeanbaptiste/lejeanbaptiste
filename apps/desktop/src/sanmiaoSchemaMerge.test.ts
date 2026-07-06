import {
  buildSanmiaoMergedSchemaFiles,
  extractDateAttributeRefs,
  generateSanmiaoHelperDefines,
  isCurrentSanmiaoMergeVersion,
  isFlatRelaxNgGrammar,
  isSanmiaoMergedWrapper,
  isTeiRelaxNgSchema,
  shouldMergeSanmiaoDates,
} from './sanmiaoSchemaMerge';

const SAMPLE_TEI_DATE = `
<define name="date">
  <element name="date">
    <zeroOrMore><choice><text/><ref name="model.phrase"/></choice></zeroOrMore>
    <ref name="att.global.attributes"/>
    <ref name="att.datable.attributes"/>
    <empty/>
  </element>
</define>
`;

const MINIMAL_TEI = `<?xml version="1.0"?>
<grammar xmlns="http://relaxng.org/ns/structure/1.0">
  <a:documentation xmlns:a="http://relaxng.org/ns/compatibility/annotations/1.0">TEI Edition: P5 Version 4.9.0</a:documentation>
  ${SAMPLE_TEI_DATE}
  <define name="persName"><element name="persName"/></define>
</grammar>`;

describe('sanmiaoSchemaMerge', () => {
  it('extracts att refs from stock TEI date', () => {
    expect(extractDateAttributeRefs(MINIMAL_TEI)).toEqual([
      'att.global.attributes',
      'att.datable.attributes',
    ]);
  });

  it('generates helper defines with sanmiao children and resolution attrs but no date define', () => {
    const helpers = generateSanmiaoHelperDefines();
    expect(helpers).toContain('ljb.sanmiao.dyn');
    expect(helpers).toContain('name="era_id"');
    expect(helpers).toContain('name="jdn"');
    expect(helpers).toContain('<element name="rel">');
    expect(helpers).toContain('<define name="ljb.sanmiao.int">');
    expect(helpers).toContain('<element name="int">');
    expect(helpers).toMatch(/<define name="ljb\.sanmiao\.int">[\s\S]*<text\/>/);
    expect(helpers).not.toContain('<define name="ljb.sanmiao.int">\n    <element name="int">\n      <empty/>');
    expect(helpers).not.toContain('<grammar');
    expect(helpers).not.toContain('<define name="date">');
  });

  it('builds a flat merged schema with sanmiao date override and helper defines', () => {
    const merged = buildSanmiaoMergedSchemaFiles(MINIMAL_TEI, 'tei_all.rng');
    expect(merged.teiCoreFileName).toBe('tei_all.tei.rng');
    expect(merged.flatRng).toContain('ns="http://www.tei-c.org/ns/1.0"');
    expect(merged.flatRng).not.toContain('<include');
    expect(merged.flatRng).not.toContain('ljb-sanmiao-dates.rng');
    expect(merged.flatRng).not.toContain('<except>');
    expect(merged.flatRng).toContain('ref name="att.datable.attributes"');
    expect(merged.flatRng).toContain('ljb.sanmiao.date.parts');
    expect(merged.flatRng).toContain('<define name="ljb.sanmiao.date.parts">');
    expect(merged.flatRng).toContain('persName');
    expect(isFlatRelaxNgGrammar(merged.flatRng)).toBe(true);
    expect(isSanmiaoMergedWrapper(merged.flatRng)).toBe(true);
    expect(isCurrentSanmiaoMergeVersion(merged.flatRng)).toBe(true);
  });

  it('flags v1 wrappers as outdated', () => {
    const v1Wrapper = `<grammar><a:documentation>Le Jean-Baptiste: TEI + sanmiao East Asian date extension</a:documentation><include href="tei_all.tei.rng"><except><define name="date"/></except></include><include href="ljb-sanmiao-dates.rng"/></grammar>`;
    expect(isSanmiaoMergedWrapper(v1Wrapper)).toBe(true);
    expect(isCurrentSanmiaoMergeVersion(v1Wrapper)).toBe(false);
  });

  it('detects TEI schemas and merge need', () => {
    expect(isTeiRelaxNgSchema(MINIMAL_TEI)).toBe(true);
    expect(shouldMergeSanmiaoDates('teiAll', MINIMAL_TEI)).toBe(true);
    expect(shouldMergeSanmiaoDates('teiAll', buildSanmiaoMergedSchemaFiles(MINIMAL_TEI, 'tei_all.rng').flatRng)).toBe(
      false,
    );
  });
});
