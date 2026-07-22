import type { SourceDescription } from './sourceDescription';
import {
  applyProfileToSource,
  dedupeProjectSources,
  profileIdentityKey,
  profileLabelFromSource,
  toSharedSource,
} from './sourceProfiles';

const sampleSource = (overrides: Partial<SourceDescription> = {}): SourceDescription => ({
  title: 'Nanqi shu',
  titleRef: 'https://www.wikidata.org/entity/Q123',
  authors: [{ name: 'Xiao Zixian' }],
  workDate: { when: '0537' },
  edition: 'Zhonghua shuju',
  editionDate: '1974',
  sourceNote: 'Juan 12',
  ...overrides,
});

describe('profileIdentityKey', () => {
  it('prefers titleRef over title', () => {
    expect(profileIdentityKey(sampleSource({ title: 'Other' }))).toBe(
      'ref:https://www.wikidata.org/entity/Q123',
    );
  });

  it('falls back to titleKey then normalized title', () => {
    expect(
      profileIdentityKey(
        sampleSource({ titleRef: undefined, titleKey: 'work-000010', title: 'Nanqi shu' }),
      ),
    ).toBe('key:work-000010');
    expect(
      profileIdentityKey(
        sampleSource({ titleRef: undefined, titleKey: undefined, title: '  Nanqi shu ' }),
      ),
    ).toBe('title:nanqi shu');
  });
});

describe('dedupeProjectSources', () => {
  it('groups identical sources and counts files', () => {
    const shared = sampleSource();
    const deduped = dedupeProjectSources([
      { source: shared, filePath: '/a/vol01.xml' },
      { source: { ...shared, sourceNote: 'Juan 13' }, filePath: '/a/vol02.xml' },
      { source: sampleSource({ title: 'Other work', titleRef: 'https://example.org/other' }), filePath: '/a/other.xml' },
    ]);

    expect(deduped).toHaveLength(2);
    const nanqi = deduped.find((entry) => entry.label === 'Nanqi shu');
    expect(nanqi?.fileCount).toBe(2);
    expect(nanqi?.samplePath).toBe('/a/vol01.xml');
  });

  it('skips empty sources', () => {
    expect(
      dedupeProjectSources([
        {
          source: sampleSource({ title: '', authors: [], titleRef: undefined, titleKey: undefined }),
          filePath: '/a/empty.xml',
        },
      ]),
    ).toHaveLength(0);
  });
});

describe('applyProfileToSource', () => {
  it('copies shared fields but preserves transcription source', () => {
    const current = sampleSource({ sourceNote: 'Local note' });
    const profile = toSharedSource(sampleSource({ edition: 'Updated edition', sourceNote: 'ignored' }));
    const merged = applyProfileToSource(current, profile);

    expect(merged.edition).toBe('Updated edition');
    expect(merged.sourceNote).toBe('Local note');
  });
});

describe('profileLabelFromSource', () => {
  it('defaults to Untitled source when title is blank', () => {
    expect(profileLabelFromSource(toSharedSource(sampleSource({ title: '   ' })))).toBe(
      'Untitled source',
    );
  });
});
