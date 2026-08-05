import type { AiApiSettings } from './projectPrefs';

export type StructuredOutputMode = 'json_schema' | 'json_object' | 'prompt_only';

export interface AiTranslationEntityRef {
  id: string;
  kind: string;
  primaryName: string | null;
  romanizedName: string | null;
  familyName: string | null;
  dates: string | null;
  description: string | null;
}

export interface AiTranslationPayload {
  alignmentUnit: string;
  sourceUnitXml: string;
  targetLanguage: string;
  entities?: AiTranslationEntityRef[];
}

const TRANSLATION_SYSTEM_PROMPT =
  'You translate scholarly XML passages. Return JSON only with one string field named translationXml. Translate only the provided passage. ' +
  'The source passage may contain tags such as persName, placeName, orgName, officeName, title, bibl, and roleName with a "key" attribute. ' +
  'A separate "entities" list in the user message gives the canonical record (kind, name, romanization, dates, description) for each such key. ' +
  'When a tagged element\'s key matches an entry in "entities", do not translate, transliterate, or otherwise write out that name yourself: replace the entire tagged mention with the exact placeholder {{entity:KEY}} (KEY is the literal key value), and use the surrounding entity metadata only to get the sentence\'s grammar right (e.g. articles, gender agreement, word order) around the placeholder. Never invent your own {{entity:...}} placeholders for keys not given to you. ' +
  'Treat any other source TEI tags (or a persName/placeName/etc. with no matching entity) as semantic hints only — do not reproduce the tags or invent a placeholder for them, just translate the enclosed text normally. ' +
  'Output plain text only, aside from the {{entity:KEY}} placeholders: no XML or HTML tags, no markdown, no angle brackets. Write ampersands and angle brackets as the XML entities &amp;, &lt;, and &gt; if they occur in the text itself.';

const PROMPT_ONLY_JSON_HINT =
  '\n\nRespond with one JSON object only, no markdown fences: {"translationXml":"…"}. translationXml must be plain text (use &amp;, &lt;, &gt; for special characters).';

export const TRANSLATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    translationXml: { type: 'string' },
  },
  required: ['translationXml'],
} as const;

/** Same policy as auto-tagging llmClient: Groq/Qwen rejects json_schema. */
export function translationStructuredOutputModes(baseUrl: string): StructuredOutputMode[] {
  if (baseUrl.includes('groq.com')) return ['prompt_only'];
  return ['json_schema', 'json_object', 'prompt_only'];
}

export function isStructuredOutputRetryable(status: number, bodyText: string): boolean {
  if (status === 400 && bodyText.includes('json_validate_failed')) return true;
  if (status < 400) return false;
  return (
    /json_schema|response_format|structured.?output/i.test(bodyText) &&
    /support|unsupported|invalid|not available|unknown|does not/i.test(bodyText)
  );
}

export function groqChatExtras(baseUrl: string, model: string): Record<string, unknown> {
  if (!baseUrl.includes('groq.com')) return {};
  if (model.includes('qwen')) return { reasoning_effort: 'none' };
  return {};
}

function buildResponseFormat(mode: StructuredOutputMode): unknown | undefined {
  if (mode === 'prompt_only') return undefined;
  if (mode === 'json_object') return { type: 'json_object' };
  return {
    type: 'json_schema',
    json_schema: {
      name: 'translation_result',
      schema: TRANSLATION_JSON_SCHEMA,
      strict: true,
    },
  };
}

export function buildTranslationRequestBody(
  model: string,
  settings: AiApiSettings,
  request: AiTranslationPayload,
  baseUrl: string,
  mode: StructuredOutputMode,
): Record<string, unknown> {
  const responseFormat = buildResponseFormat(mode);
  const systemContent =
    mode === 'prompt_only' ? TRANSLATION_SYSTEM_PROMPT + PROMPT_ONLY_JSON_HINT : TRANSLATION_SYSTEM_PROMPT;

  return {
    model,
    temperature: settings.temperature,
    ...groqChatExtras(baseUrl, model),
    messages: [
      { role: 'system', content: systemContent },
      {
        role: 'user',
        content: JSON.stringify({
          targetLanguage: request.targetLanguage,
          alignmentUnit: request.alignmentUnit,
          customInstructions: settings.customInstructions,
          sourceUnitXml: request.sourceUnitXml,
          entities: request.entities ?? [],
        }),
      },
    ],
    ...(responseFormat ? { response_format: responseFormat } : {}),
  };
}
