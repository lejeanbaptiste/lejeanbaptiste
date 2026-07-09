import {
  buildAuditAddPrompt,
  buildAuditCleanPrompt,
  buildSuggestPrompt,
  buildSuggestTagGuide,
  injectPlaceholder,
  AUDIT_ADD_PROMPT_VERSION,
  AUDIT_CLEAN_PROMPT_VERSION,
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
    expect(system).not.toContain('%s');
    const { user } = buildSuggestPrompt({
      tags: ['persName', 'placeName'],
      chunkText: 'test',
      before: '',
      after: '',
    });
    expect(user).toContain('<chunk>test</chunk>');
  });

  it('uses split audit prompts for clean and add passes', () => {
    expect(AUDIT_CLEAN_PROMPT_VERSION).toBe('audit-clean.v2');
    expect(AUDIT_ADD_PROMPT_VERSION).toBe('audit-add.v1');
    const clean = buildAuditCleanPrompt({
      tags: ['persName', 'placeName'],
      taggedChunkText: '<persName>張衡</persName>',
      before: '',
      after: '',
    });
    expect(clean.system).toContain('AUDIT CLEAN');
    expect(clean.system).toContain('Never use action "add"');
    const add = buildAuditAddPrompt({
      tags: ['persName', 'placeName'],
      taggedChunkText: '<persName>張衡</persName>與洛陽',
      before: '',
      after: '',
    });
    expect(add.system).toContain('AUDIT ADD');
    expect(add.system).toContain('PLAIN TEXT ONLY');
    expect(add.system).toContain('substring');
  });

  it('injects the tag guide into a %s placeholder and falls back when missing', () => {
    const withPlaceholder = buildSuggestPrompt({
      tags: ['persName'],
      chunkText: 'test',
      before: '',
      after: '',
      suggestTaskText: 'Custom intro.%s Custom end.',
    });
    expect(withPlaceholder.system).toContain('Custom intro.');
    expect(withPlaceholder.system).toContain('Tagging guide');
    expect(withPlaceholder.system).not.toContain('%s');

    const withoutPlaceholder = buildAuditCleanPrompt({
      tags: ['persName'],
      taggedChunkText: '<persName>張衡</persName>',
      before: '',
      after: '',
      auditCleanTaskText: 'Custom audit task.',
    });
    expect(withoutPlaceholder.system).toContain('Custom audit task.');
    expect(withoutPlaceholder.system).toContain('Tagging guide');
  });

  it('supports generic placeholder injection for other prompt families', () => {
    expect(injectPlaceholder('Hello %s!', 'world')).toBe('Hello world!');
    expect(injectPlaceholder('Hello there!', 'world')).toBe('Hello there!');
  });
});
