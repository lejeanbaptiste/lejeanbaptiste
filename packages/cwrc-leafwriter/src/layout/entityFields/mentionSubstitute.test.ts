/**
 * @jest-environment jsdom
 */
import type { MentionContext } from './mentionContext';
import type { EntitySummary } from './entitySummary';
import { substituteMentionPlaceholders } from './mentionSubstitute';

const office = (): EntitySummary => ({
  id: 'office-15',
  kind: 'office',
  names: [
    { lang: 'zh', text: '右將軍', type: 'primary' },
    { lang: 'en', text: 'Right General', type: 'translation' },
  ],
  primaryName: '右將軍',
  romanizedName: 'You Jiangjun',
  translations: [{ lang: 'en', text: 'Right General' }],
  description: null,
  dates: null,
  familyName: null,
  authorityIds: [],
  classification: null,
  workType: null,
});

const mention = (
  partial: Partial<MentionContext> & Pick<MentionContext, 'index' | 'key' | 'surface'>,
): MentionContext => ({
  kind: 'office',
  teiTag: 'roleName',
  teiType: null,
  role: 'office-as-written',
  placeholderRole: 'as',
  ...partial,
});

describe('substituteMentionPlaceholders', () => {
  test('replaces {{as:N}} and {{holding:N}} tokens (not only {{mention:N}})', () => {
    const manifest: MentionContext[] = [
      mention({
        index: 0,
        key: 'office-15',
        surface: '右將軍',
        placeholderRole: 'as',
      }),
    ];
    const entities = new Map([['office-15', office()]]);
    const xml = '<p>sent out to serve as {{as:0}}, then again.</p>';
    const out = substituteMentionPlaceholders(xml, manifest, entities, {
      lang: 'en',
      sourceLang: 'zh',
    });
    expect(out).not.toContain('{{as:0}}');
    expect(out).toContain('Right General');
  });

  test('replaces {{holding:N}} without any {{mention:N}} in the fragment', () => {
    const manifest: MentionContext[] = [
      mention({
        index: 0,
        key: 'office-15',
        surface: '駙馬都尉',
        placeholderRole: 'holding',
      }),
    ];
    const entities = new Map([['office-15', office()]]);
    const out = substituteMentionPlaceholders('<p>{{holding:0}} X</p>', manifest, entities, {
      lang: 'en',
      sourceLang: 'zh',
    });
    expect(out).not.toContain('{{holding:0}}');
    expect(out).toContain('ref');
  });
});
