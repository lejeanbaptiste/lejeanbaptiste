import {
  attributeNameMatchRank,
  filterAttributeSuggestions,
  orderAttributeSuggestions,
  resolveAttributeNameForApply,
  sortAttributeSuggestions,
  suggestAttributeValues,
  type SchemaAttributeDetail,
} from './attributeSuggestions';
import type { TagUsageStats } from './tagStats';

const stats: TagUsageStats = {
  version: 1,
  project: {
    tags: { persName: 5 },
    attrs: { persName: { ref: 3, key: 1, cert: 1 } },
    attrValues: {
      persName: {
        ref: { 'http://a': 2, 'http://b': 1 },
        key: { p1: 1 },
        cert: { high: 1 },
      },
    },
  },
  files: {},
};

const attrs: SchemaAttributeDetail[] = [
  { name: 'cert', required: false },
  { name: 'key', required: false },
  { name: 'ref', required: false },
];

describe('sortAttributeSuggestions', () => {
  test('sorts by project usage count then name', () => {
    const sorted = sortAttributeSuggestions(attrs, 'persName', stats);
    expect(sorted.map((a) => a.name)).toEqual(['ref', 'cert', 'key']);
  });
});

describe('attributeNameMatchRank', () => {
  test('ranks xml:id above evidence when filtering id', () => {
    expect(attributeNameMatchRank('xml:id', 'id')).toBeLessThan(
      attributeNameMatchRank('evidence', 'id'),
    );
  });
});

describe('orderAttributeSuggestions', () => {
  test('puts invalid attributes last and ranks name matches', () => {
    const attrs: SchemaAttributeDetail[] = [
      { name: 'evidence' },
      { name: 'xml:id' },
      { name: 'cert', invalid: true },
    ];
    const ordered = orderAttributeSuggestions(attrs, 'p', stats, 'id');
    expect(ordered.map((attr) => attr.name)).toEqual(['xml:id', 'evidence', 'cert']);
  });
});

describe('filterAttributeSuggestions', () => {
  test('filters by name or fullName', () => {
    const withFull = [{ name: 'ref', fullName: 'reference' }, { name: 'key' }];
    expect(filterAttributeSuggestions(withFull, 'ref')).toHaveLength(1);
    expect(filterAttributeSuggestions(withFull, 'reference')).toHaveLength(1);
  });
});

describe('suggestAttributeValues', () => {
  test('returns values sorted by usage with current value first if new', () => {
    const values = suggestAttributeValues('persName', 'ref', stats, 'http://new');
    expect(values[0]).toBe('http://new');
    expect(values).toContain('http://a');
  });
});

describe('resolveAttributeNameForApply', () => {
  test('prefers highlighted then exact filter match', () => {
    expect(resolveAttributeNameForApply(attrs, 'key', attrs[1]!)).toEqual(attrs[1]);
    expect(resolveAttributeNameForApply(attrs, 'ref', null)?.name).toBe('ref');
  });

  test('maps id filter to xml:id schema attribute', () => {
    const withId = [{ name: 'xml:id' }, ...attrs];
    expect(resolveAttributeNameForApply(withId, 'id', null)?.name).toBe('xml:id');
  });

  test('allows free-text editable attribute names', () => {
    expect(resolveAttributeNameForApply([], 'customAttr', null)?.name).toBe('customAttr');
    expect(resolveAttributeNameForApply([], '_tag', null)).toBeNull();
  });
});
