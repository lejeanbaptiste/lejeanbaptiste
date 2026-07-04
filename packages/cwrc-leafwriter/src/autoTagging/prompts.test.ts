import {
  buildSuggestPrompt,
  buildSuggestTagGuide,
  SUGGEST_PROMPT_VERSION,
} from './prompts';

describe('prompts', () => {
  it('uses suggest.v3 with tag definitions for persName and placeName', () => {
    expect(SUGGEST_PROMPT_VERSION).toBe('suggest.v3');
    const guide = buildSuggestTagGuide(['persName', 'placeName']);
    expect(guide).toContain('persName');
    expect(guide).toContain('placeName');
    expect(guide).toContain('京兆');
  });

  it('omits definitions for unlisted tags', () => {
    expect(buildSuggestTagGuide(['persName'])).not.toContain('placeName:');
  });

  it('includes tag guide and recall instruction in suggest system prompt', () => {
    const { system } = buildSuggestPrompt({
      tags: ['persName', 'placeName'],
      chunkText: 'test',
      before: '',
      after: '',
    });
    expect(system).toContain('Tagging guide');
    expect(system).toContain('action');
    expect(system).toContain('"add"');
    const { user } = buildSuggestPrompt({
      tags: ['persName', 'placeName'],
      chunkText: 'test',
      before: '',
      after: '',
    });
    expect(user).toContain('<chunk>test</chunk>');
  });
});
