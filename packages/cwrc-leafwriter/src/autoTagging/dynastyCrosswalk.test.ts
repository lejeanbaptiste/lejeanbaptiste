import { canonicalNationalityLabel } from './dynastyCrosswalk';

describe('canonicalNationalityLabel', () => {
  it('merges a common dynasty-suffix spelling into the curated label', () => {
    expect(canonicalNationalityLabel('Norbert', null, '唐')).toBe('唐');
    expect(canonicalNationalityLabel('CBDB', null, '唐朝')).toBe('唐');
  });

  it('uses source ids before labels when they are available', () => {
    expect(canonicalNationalityLabel('CBDB', 'CBDB:dynasty:6', '唐朝')).toBe('唐');
  });
});
