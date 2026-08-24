import {
  bucketForTypedName,
  defaultPolicyForLanguage,
  filterCandidateForPhase1,
  isPhase1SeedName,
  isPhase2SeedName,
  phase1SearchStringsFromCandidate,
  resolveNameTypeTaggingPolicy,
  validateCustomNameTypeId,
} from './nameTypeTaggingPolicy';

describe('defaultPolicyForLanguage', () => {
  it('applies Chinese defaults (family never, courtesy/given phase2)', () => {
    const zh = defaultPolicyForLanguage('zh-Hant');
    expect(zh.family).toBe('never');
    expect(zh.courtesy).toBe('phase2');
    expect(zh.given).toBe('phase2');
    expect(zh.primary).toBe('phase1');
    expect(zh.birth).toBe('phase1');
  });

  it('applies Japanese defaults including birth in phase2', () => {
    const ja = defaultPolicyForLanguage('ja');
    expect(ja.family).toBe('never');
    expect(ja.birth).toBe('phase2');
    expect(ja.courtesy).toBe('phase2');
  });

  it('applies Tibetan defaults with variant in phase2', () => {
    const bo = defaultPolicyForLanguage('bo');
    expect(bo.variant).toBe('phase2');
    expect(bo.courtesy).toBe('phase2');
  });

  it('applies English defaults with given in phase2 only', () => {
    const en = defaultPolicyForLanguage('en');
    expect(en.given).toBe('phase2');
    expect(en.courtesy).toBe('phase1');
  });

  it('treats null language as Chinese', () => {
    expect(defaultPolicyForLanguage(null)).toEqual(defaultPolicyForLanguage('zh'));
  });
});

describe('bucketForTypedName', () => {
  const zhPolicy = resolveNameTypeTaggingPolicy(undefined, 'zh');

  it('routes untyped names to phase1', () => {
    expect(bucketForTypedName(null, '张衡', zhPolicy)).toBe('phase1');
  });

  it('length-gates art names', () => {
    expect(isPhase1SeedName('art', '半山老人', zhPolicy)).toBe(true);
    expect(isPhase2SeedName('art', '半山', zhPolicy)).toBe(true);
    expect(isPhase1SeedName('art', '半', zhPolicy)).toBe(false);
  });

  it('honors never bucket for art regardless of length', () => {
    const policy = resolveNameTypeTaggingPolicy({ nameTypeTaggingPolicy: { art: 'never' } }, 'zh');
    expect(bucketForTypedName('art', '半山老人', policy)).toBe('never');
  });

  it('resolves custom type ids', () => {
    const policy = resolveNameTypeTaggingPolicy(
      {
        customNameTypes: [{ id: 'honorific', label: 'Honorific', bucket: 'never' }],
      },
      'zh',
    );
    expect(bucketForTypedName('honorific', '公', policy)).toBe('never');
  });
});

describe('resolveNameTypeTaggingPolicy migration', () => {
  it('migrates legacy excludedNameTypes to phase2 while keeping family never', () => {
    const policy = resolveNameTypeTaggingPolicy({ excludedNameTypes: ['courtesy', 'art'] }, 'zh');
    expect(policy.buckets.courtesy).toBe('phase2');
    expect(policy.buckets.art).toBe('phase2');
    expect(policy.buckets.family).toBe('never');
  });

  it('lets explicit nameTypeTaggingPolicy override legacy exclusions', () => {
    const policy = resolveNameTypeTaggingPolicy(
      {
        excludedNameTypes: ['courtesy'],
        nameTypeTaggingPolicy: { courtesy: 'phase1' },
      },
      'zh',
    );
    expect(policy.buckets.courtesy).toBe('phase1');
  });

  it('forces family to never unless explicitly set in nameTypeTaggingPolicy', () => {
    const policy = resolveNameTypeTaggingPolicy(
      { excludedNameTypes: ['family'], nameTypeTaggingPolicy: {} },
      'zh',
    );
    expect(policy.buckets.family).toBe('never');

    const overridden = resolveNameTypeTaggingPolicy(
      { nameTypeTaggingPolicy: { family: 'phase2' } },
      'zh',
    );
    expect(overridden.buckets.family).toBe('phase2');
  });
});

describe('phase1SearchStringsFromCandidate', () => {
  const zhPolicy = resolveNameTypeTaggingPolicy(undefined, 'zh');

  it('filters CBDB-like courtesy composite from phase1 searchStrings', () => {
    const filtered = phase1SearchStringsFromCandidate(
      {
        searchStrings: ['王安石', '王介甫'],
        names: [
          { text: '王安石', type: 'primary' },
          { text: '王介甫', type: 'courtesy' },
        ],
      },
      zhPolicy,
    );
    expect(filtered).toEqual(['王安石']);
  });

  it('keeps all searchStrings when names is absent (legacy packs)', () => {
    expect(
      phase1SearchStringsFromCandidate({ searchStrings: ['王安石', '王介甫'] }, zhPolicy),
    ).toEqual(['王安石', '王介甫']);
  });

  it('keeps untyped names in searchStrings as phase1', () => {
    const filtered = phase1SearchStringsFromCandidate(
      {
        searchStrings: ['张衡', '平子'],
        names: [{ text: '张衡' }, { text: '平子', type: 'courtesy' }],
      },
      zhPolicy,
    );
    expect(filtered).toEqual(['张衡']);
  });
});

describe('filterCandidateForPhase1', () => {
  it('returns a shallow copy with filtered searchStrings', () => {
    const policy = resolveNameTypeTaggingPolicy(undefined, 'zh');
    const candidate = {
      source: 'CBDB',
      authorityId: '1762',
      kind: 'person' as const,
      primaryName: '王安石',
      searchStrings: ['王安石', '王介甫'],
      names: [
        { text: '王安石', type: 'primary' },
        { text: '王介甫', type: 'courtesy' },
      ],
    };
    const filtered = filterCandidateForPhase1(candidate, policy);
    expect(filtered).not.toBe(candidate);
    expect(filtered.searchStrings).toEqual(['王安石']);
    expect(filtered.names).toEqual(candidate.names);
  });
});

describe('validateCustomNameTypeId', () => {
  it('accepts ASCII slugs and rejects built-in shadowing', () => {
    expect(validateCustomNameTypeId('honorific')).toBeNull();
    expect(validateCustomNameTypeId('Honorific')).toBe('invalid_slug');
    expect(validateCustomNameTypeId('courtesy')).toBe('shadows_builtin');
  });
});
