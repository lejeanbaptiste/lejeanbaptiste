import { repairTeiHeader } from './teiHeaderRepair';

const schema = `<?xml version="1.0"?>
<grammar xmlns="http://relaxng.org/ns/structure/1.0">
  <define name="teiHeader"><element name="teiHeader"><group>
    <ref name="fileDesc"/><zeroOrMore><ref name="model.teiHeaderPart"/></zeroOrMore><optional><ref name="revisionDesc"/></optional>
  </group></element></define>
  <define name="model.teiHeaderPart"><choice><ref name="encodingDesc"/><ref name="profileDesc"/><ref name="xenoData"/></choice></define>
</grammar>`;

const invalid = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc/><revisionDesc/><profileDesc/></teiHeader><text><body><p>Body</p></body></text></TEI>`;

describe('repairTeiHeader', () => {
  it('derives the order from Relax NG and changes only the header order', () => {
    const result = repairTeiHeader(invalid, schema);
    expect(result?.beforeOrder).toEqual(['fileDesc', 'revisionDesc', 'profileDesc']);
    expect(result?.afterOrder).toEqual(['fileDesc', 'profileDesc', 'revisionDesc']);
    expect(result?.repairedXml).toContain('<p>Body</p>');
    expect(result?.description).toContain('revisionDesc');
  });

  it('does not repair an already canonical header', () => {
    const valid = invalid.replace(
      '<fileDesc/><revisionDesc/><profileDesc/>',
      '<fileDesc/><profileDesc/><revisionDesc/>',
    );
    expect(repairTeiHeader(valid, schema)).toBeNull();
  });
});
