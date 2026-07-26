import { validatePersonWrapper } from './personWrapperValidation';

describe('personWrapper validation', () => {
  it('accepts one keyed wrapper with a noble-title relation', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI><text><name type="personWrapper" key="person-7"><roleName>合州刺史</roleName><nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle><persName key="person-7">範</persName></name></text></TEI>',
      'application/xml',
    );
    expect(validatePersonWrapper(doc.getElementsByTagName('name')[0]!)).toEqual({ valid: true, errors: [] });
  });

  it('rejects an unkeyed wrapper and an empty title', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI><text><name type="personWrapper"><nobleTitle>王</nobleTitle></name></text></TEI>',
      'application/xml',
    );
    const result = validatePersonWrapper(doc.getElementsByTagName('name')[0]!);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('personWrapper requires exactly one person key');
    expect(result.errors).toContain('personWrapper must contain a persName');
    expect(result.errors).toContain('nobleTitle must contain a placeName or roleName');
  });

  it('treats cert=unknown as pending rather than structurally invalid', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI><text><name type="personWrapper" cert="unknown"><persName>範</persName></name></text></TEI>',
      'application/xml',
    );
    expect(validatePersonWrapper(doc.getElementsByTagName('name')[0]!)).toEqual({
      valid: true,
      errors: [],
      pending: 1,
    });
  });
});
