import { DEFAULT_AI_API_SETTINGS } from './projectPrefs';
import {
  GLOSS_JSON_SCHEMA,
  buildEntityGlossRequestBody,
  parseEntityGlossContent,
} from './aiEntityGlossLlm';

describe('aiEntityGlossLlm', () => {
  const request = {
    kind: 'work',
    primaryName: '晉書',
    romanizedName: 'Jinshu',
    chineseName: '晉書',
    description: 'Official history of the Jin dynasty',
    targetLanguage: 'fr',
  };

  test('buildEntityGlossRequestBody includes schema for json_schema mode', () => {
    const body = buildEntityGlossRequestBody(
      'test-model',
      { ...DEFAULT_AI_API_SETTINGS, temperature: 0.2, customInstructions: 'Be concise.' },
      request,
      'https://api.example.com/v1',
      'json_schema',
    );

    expect(body.model).toBe('test-model');
    expect(body.temperature).toBe(0.2);
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'entity_gloss_result',
        schema: GLOSS_JSON_SCHEMA,
        strict: true,
      },
    });

    const messages = body.messages as { role: string; content: string }[];
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.role).toBe('user');
    const payload = JSON.parse(messages[1]!.content) as Record<string, unknown>;
    expect(payload).toMatchObject({
      targetLanguage: 'fr',
      kind: 'work',
      primaryName: '晉書',
      romanizedName: 'Jinshu',
      chineseName: '晉書',
      customInstructions: 'Be concise.',
    });
  });

  test('buildEntityGlossRequestBody omits response_format for prompt_only', () => {
    const body = buildEntityGlossRequestBody(
      'test-model',
      DEFAULT_AI_API_SETTINGS,
      request,
      'https://api.groq.com/openai/v1',
      'prompt_only',
    );
    expect(body.response_format).toBeUndefined();
    const messages = body.messages as { role: string; content: string }[];
    expect(messages[0]?.content).toContain('{"gloss":"…"}');
  });

  test('parseEntityGlossContent reads JSON gloss and fenced JSON', () => {
    expect(parseEntityGlossContent('{"gloss":"Livre des Jin"}')).toBe('Livre des Jin');
    expect(parseEntityGlossContent('```json\n{"gloss":"Livre des Jin"}\n```')).toBe('Livre des Jin');
    expect(parseEntityGlossContent('Livre des Jin')).toBe('Livre des Jin');
    expect(parseEntityGlossContent('{"gloss":""}')).toBeNull();
    expect(parseEntityGlossContent('{not-json')).toBeNull();
  });
});
