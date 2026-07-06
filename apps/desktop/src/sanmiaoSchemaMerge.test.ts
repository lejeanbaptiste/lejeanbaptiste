import {
  buildSanmiaoMergedSchemaFiles,
  extractDateAttributeRefs,
  generateSanmiaoDatesPatchRng,
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
</grammar>`;

describe('sanmiaoSchemaMerge', () => {
  it('extracts att refs from stock TEI date', () => {
    expect(extractDateAttributeRefs(MINIMAL_TEI)).toEqual([
      'att.global.attributes',
      'att.datable.attributes',
    ]);
  });

  it('generates patch with sanmiao children and resolution attrs', () => {
    const patch = generateSanmiaoDatesPatchRng(MINIMAL_TEI);
    expect(patch).toContain('ljb.sanmiao.dyn');
    expect(patch).toContain('name="era_id"');
    expect(patch).toContain('name="jdn"');
    expect(patch).toContain('<element name="rel">');
    expect(patch).toContain('ref name="att.datable.attributes"');
  });

  it('builds wrapper that includes patch and tei core', () => {
    const merged = buildSanmiaoMergedSchemaFiles(MINIMAL_TEI, 'tei_all.rng');
    expect(merged.teiCoreFileName).toBe('tei_all.tei.rng');
    expect(merged.wrapperRng).toContain('tei_all.tei.rng');
    expect(merged.wrapperRng).toContain('ljb-sanmiao-dates.rng');
    expect(isSanmiaoMergedWrapper(merged.wrapperRng)).toBe(true);
  });

  it('detects TEI schemas and merge need', () => {
    expect(isTeiRelaxNgSchema(MINIMAL_TEI)).toBe(true);
    expect(shouldMergeSanmiaoDates('teiAll', MINIMAL_TEI)).toBe(true);
    expect(shouldMergeSanmiaoDates('teiAll', buildSanmiaoMergedSchemaFiles(MINIMAL_TEI, 'tei_all.rng').wrapperRng)).toBe(
      false,
    );
  });
});
