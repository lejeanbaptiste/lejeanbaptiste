import { isInfrastructurePath } from './infrastructurePaths';

describe('isInfrastructurePath', () => {
  it('flags files under the reserved /.leaf/ directory', () => {
    expect(isInfrastructurePath('/proj/.leaf/entities.xml')).toBe(true);
    expect(isInfrastructurePath('/proj/.leaf/entity-decisions.jsonl')).toBe(true);
    expect(isInfrastructurePath('C:\\proj\\.leaf\\entities.xml')).toBe(true);
  });

  it('leaves normal corpus files alone', () => {
    expect(isInfrastructurePath('/proj/chapter1.xml')).toBe(false);
    expect(isInfrastructurePath('/proj/schema/tei_all.rng')).toBe(false);
    // a file merely named similarly is not infrastructure
    expect(isInfrastructurePath('/proj/my.leaf.notes.xml')).toBe(false);
  });
});
