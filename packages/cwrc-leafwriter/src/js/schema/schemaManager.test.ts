jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import SchemaManager from './schemaManager';

describe('SchemaManager.revisionFromRngContent', () => {
  it('changes when the RNG changes after the first 4 KB', () => {
    const prefix = 'x'.repeat(4096);
    const revisionA = SchemaManager.revisionFromRngContent(`${prefix}<define name="p"/>`);
    const revisionB = SchemaManager.revisionFromRngContent(`${prefix}<define name="persName"/>`);

    expect(revisionA).not.toBe(revisionB);
  });

  it('preserves explicit merge markers', () => {
    expect(SchemaManager.revisionFromRngContent('foo grognard-sanmiao-merge v4 bar')).toBe(
      'grognard-sanmiao-merge v4',
    );
  });
});
