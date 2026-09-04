import { validatePersonWrapper } from './personWrapperValidation';

describe('personWrapper validation', () => {
  it('accepts one keyed wrapper with a noble-title relation', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI><text><name type="personWrapper" key="person-7"><roleName>合州刺史</roleName><nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle><persName key="person-7">範</persName></name></text></TEI>',
      'application/xml',
    );
    expect(validatePersonWrapper(doc.getElementsByTagName('name')[0]!)).toEqual({
      valid: true,
      errors: [],
    });
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
      '<TEI><text><name type="personWrapper" cert="unknown"><placeName>陳郡</placeName><persName>範</persName></name></text></TEI>',
      'application/xml',
    );
    expect(validatePersonWrapper(doc.getElementsByTagName('name')[0]!)).toEqual({
      valid: true,
      errors: [],
      pending: 1,
    });
  });

  it('rejects a lone persName with no other component', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI><text><name type="personWrapper" cert="unknown"><persName>範</persName></name></text></TEI>',
      'application/xml',
    );
    const result = validatePersonWrapper(doc.getElementsByTagName('name')[0]!);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'personWrapper must contain persName plus at least one other component',
    );
  });

  it('accepts every leading slot omitted except one, in canonical order', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI><text><name type="personWrapper" key="person-7"><nationality>晉</nationality><roleName>刺史</roleName><nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle><placeName>陳郡</placeName><persName key="person-7">範</persName></name></text></TEI>',
      'application/xml',
    );
    expect(validatePersonWrapper(doc.getElementsByTagName('name')[0]!)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects a placeName (origin) that precedes roleName', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI><text><name type="personWrapper" key="person-7"><placeName>陳郡</placeName><roleName>刺史</roleName><persName key="person-7">範</persName></name></text></TEI>',
      'application/xml',
    );
    const result = validatePersonWrapper(doc.getElementsByTagName('name')[0]!);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'personWrapper children out of order: roleName follows placeName, but the order must be nationality, roleName, nobleTitle, placeName, then persName',
    );
  });

  it('rejects a nobleTitle that follows the origin placeName', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI><text><name type="personWrapper" key="person-7"><placeName>陳郡</placeName><nobleTitle><placeName>鄱陽</placeName><roleName>王</roleName></nobleTitle><persName key="person-7">範</persName></name></text></TEI>',
      'application/xml',
    );
    const result = validatePersonWrapper(doc.getElementsByTagName('name')[0]!);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'personWrapper children out of order: nobleTitle follows placeName, but the order must be nationality, roleName, nobleTitle, placeName, then persName',
    );
  });

  it('accepts two adjacent components of the same slot type', () => {
    const doc = new DOMParser().parseFromString(
      '<TEI><text><name type="personWrapper" key="person-7"><placeName>陳郡</placeName><placeName>陽夏</placeName><persName key="person-7">範</persName></name></text></TEI>',
      'application/xml',
    );
    expect(validatePersonWrapper(doc.getElementsByTagName('name')[0]!)).toEqual({
      valid: true,
      errors: [],
    });
  });
});
