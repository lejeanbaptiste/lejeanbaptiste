import type { AiPromptProfile } from './aiPromptProfiles';
import { DEFAULT_VALIDATION_TASK_TEXT, resolveValidationTaskText } from './aiPromptProfiles';
import type { AiValidationResult, Suggestion } from './types';
import type { LlmClient } from './llmClient';
import type { ChunkOptions } from './chunk';

/**
 * Validates suggestions using LLM to identify incorrect tags without letting
 * the model collapse same-span alternatives into a single winner.
 */

export interface ValidationContextOptions extends ChunkOptions {
  /** Tags being validated. */
  tags: string[];
  /** Project-specific schema rules as context. */
  schemaRules?: string[];
}

export interface ValidateSuggestionsOptions {
  suggestions: Suggestion[];
  client: LlmClient;
  promptProfile?: AiPromptProfile | null;
  schemaRules?: string[];
  /** Document language for context (e.g., 'Chinese', 'Japanese', 'Tibetan'). Falls back to 'historical' if not provided. */
  language?: string;
  /** Suggestions per LLM call — keeps requests under small-tier token-per-minute limits. Default 8. */
  batchSize?: number;
  onProgress?: (done: number, total: number) => void;
  /** Called after each batch so the UI can show scores without waiting for the full run. */
  onBatch?: (batch: Map<string, AiValidationResult>, done: number, total: number) => void;
  /** Abort between batches (in-flight request is not cancelled). */
  signal?: AbortSignal;
}

/**
 * Suggestions per validation call. Each line is now just tag/surface/action
 * plus a 12-char local context (the old shared 2000-char doc blob and the
 * per-suggestion candidate-disambiguation dump were dropped — they were the
 * actual token cost, not suggestion count), so this can stay high: fewer,
 * larger requests beat many small ones under a strict tokens-per-minute cap
 * since every request repeats the ~200-token system prompt.
 */
const DEFAULT_VALIDATION_BATCH_SIZE = 20;

/** Gap between batches so consecutive calls don't all land in the same rate-limit window. */
const BATCH_PACING_MS = 4000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function chunkSuggestions<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * Single validation result from LLM for one suggestion.
 */
export interface RawValidationResult {
  /** Suggestion ID. */
  id: string;
  /** Validation confidence score (0-1). */
  confidence: number;
  /** Warning message if AI flags this as incorrect. */
  warning?: string;
  /** True if AI recommends this suggestion. */
  recommended: boolean;
  /** AI's rationale for its decision. */
  rationale?: string;
}

/**
 * Response schema for validation LLM calls.
 */
const validationResponseSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    validations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          warning: { type: 'string' },
          recommended: { type: 'boolean' },
          rationale: { type: 'string' },
        },
        required: ['id', 'confidence', 'recommended'],
      },
    },
  },
  required: ['validations'],
  additionalProperties: false,
};

/**
 * Build user prompt for validating a batch of suggestions.
 */
function buildValidationUserPrompt(params: {
  suggestions: Suggestion[];
  schemaRules: string[];
  language?: string;
}): string {
  const langLabel = params.language ? `${params.language} ` : '';
  const lines: string[] = [
    `Curate the following dictionary/auto-tag suggestions for ${langLabel}historical texts.`,
    'Goal: flag tags that are *obviously wrong* (wrong entity type, nonsense boundary, common-word false positive).',
    'Do not reject merely ambiguous or hard cases — leave those recommended=true with mid confidence.',
    'Suggestions come from two different kinds of producer, marked below:',
    '- [dictionary]: a literal string match against an authority/gazetteer database. The tag reflects what that',
    '  database calls the string in general, NOT that anyone has confirmed it means that HERE. Common words that',
    '  happen to coincide with a place name, office title, or person name are the main failure mode — judge the',
    '  "dictionary clue" against whether the local context actually supports that specific reading.',
    '- [ai]: a model already read the passage and proposed this tag from context, so a lower prior error rate.',
    'For each suggestion, assess:',
    '1. Whether the tag is semantically plausible for the surface string in its local context',
    '2. Whether the boundary spans look accurate',
    '3. Score each suggestion independently, even when the same surface appears with multiple tags — when two',
    '   tags compete for the same span (e.g. the same string offered as both roleName and placeName), decide',
    '   which reading the sentence actually supports and score them accordingly; do not default to the higher',
    '   dictionary-clue specificity or to whichever option happens to be listed first',
    '4. confidence = how sure you are the tag is correct (0=clearly wrong, 1=clearly right)',
    '5. recommended=false only when the tag is clearly wrong',
    '',
    'Suggestions (use exact id in your response):',
  ];

  for (const s of params.suggestions) {
    const ruleNotes =
      params.schemaRules.length > 0 ? `\n  Schema notes: ${params.schemaRules.join(', ')}` : '';
    const originLabel =
      s.source === 'authority' ? 'dictionary' : s.source === 'ai' ? 'ai' : s.source;
    const dictionaryClue =
      s.source === 'authority' && s.rationale ? `\n  Dictionary clue: ${s.rationale}` : '';
    const localContext = `…${s.anchor.contextBefore}【${s.anchor.surface}】${s.anchor.contextAfter}…`;
    lines.push(
      `- id=${s.id}: [${originLabel}] tag=<${s.tag}>, surface="${s.anchor.surface}", action=${s.action}` +
        (s.confidence !== undefined ? `, confidence=${s.confidence.toFixed(2)}` : '') +
        `\n  Context: ${localContext}` +
        dictionaryClue +
        ruleNotes,
    );
  }

  lines.push('');
  lines.push('Respond with a JSON object containing a "validations" array.');
  lines.push(
    'Each validation must include: id, confidence (0-1), recommended (boolean), and optionally warning, rationale.',
  );
  lines.push(
    'Do not choose or infer a single winner for same-surface alternatives; evaluate each listed suggestion on its own.',
  );

  return lines.join('\n');
}

/**
 * Parse validation response from LLM.
 */
function parseValidationResponse(
  json: string,
  suggestionIds: Set<string>,
): Map<string, AiValidationResult> {
  const result = new Map<string, AiValidationResult>();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return result;
  }

  if (!parsed || typeof parsed !== 'object') return result;
  const body = parsed as Record<string, unknown>;

  const validations = Array.isArray(body.validations) ? body.validations : [];

  for (const raw of validations) {
    if (!raw || typeof raw !== 'object') continue;
    const v = raw as Record<string, unknown>;

    const id = typeof v.id === 'string' && suggestionIds.has(v.id) ? v.id : null;
    if (!id) continue;

    const confidence =
      typeof v.confidence === 'number' && v.confidence >= 0 && v.confidence <= 1
        ? v.confidence
        : 0.5;

    const warning =
      typeof v.warning === 'string' && v.warning.trim() !== '' ? v.warning.trim() : undefined;
    const recommended = v.recommended === true;
    const rationale =
      typeof v.rationale === 'string' && v.rationale.trim() !== '' ? v.rationale.trim() : undefined;

    result.set(id, {
      confidence,
      warning,
      recommended,
      rationale,
      validatedAt: new Date().toISOString(),
    });
  }

  return result;
}

/**
 * Validate a batch of suggestions using LLM.
 */
export async function validateSuggestions(
  options: ValidateSuggestionsOptions,
): Promise<Map<string, AiValidationResult>> {
  const {
    suggestions,
    client,
    promptProfile,
    schemaRules = [],
    language,
    batchSize = DEFAULT_VALIDATION_BATCH_SIZE,
    onProgress,
    onBatch,
    signal,
  } = options;

  if (suggestions.length === 0) {
    return new Map();
  }

  const result = new Map<string, AiValidationResult>();

  const taskText = resolveValidationTaskText(promptProfile);
  const batches = chunkSuggestions(suggestions, Math.max(1, batchSize));

  for (let i = 0; i < batches.length; i++) {
    if (signal?.aborted) break;
    const batch = batches[i]!;
    const batchIds = new Set(batch.map((s) => s.id));
    const userPrompt = buildValidationUserPrompt({
      suggestions: batch,
      schemaRules,
      language,
    });

    if (i > 0) await sleep(BATCH_PACING_MS);
    if (signal?.aborted) break;

    try {
      const response = await client.complete({
        system: taskText ?? DEFAULT_VALIDATION_TASK_TEXT,
        user: userPrompt,
        jsonSchema: validationResponseSchema,
      });

      const parsed = parseValidationResponse(response.json, batchIds);
      for (const [id, validation] of parsed) {
        result.set(id, validation);
      }
      if (parsed.size > 0) onBatch?.(parsed, i + 1, batches.length);
    } catch (error) {
      // Silent fail per batch - one failed batch shouldn't stop the rest.
      console.warn('AI validation batch failed:', error);
    }

    onProgress?.(i + 1, batches.length);
  }

  return result;
}

/** Effective curation confidence: AI score when present, else producer confidence. */
export function suggestionCurateConfidence(suggestion: Suggestion): number | undefined {
  return suggestion.aiValidation?.confidence ?? suggestion.confidence;
}

/**
 * Get validation confidence color for display.
 */
export function getValidationColor(
  confidence: number | undefined,
): 'error' | 'warning' | 'success' | 'default' {
  if (confidence === undefined) return 'default';
  if (confidence >= 0.8) return 'success';
  if (confidence >= 0.5) return 'warning';
  return 'error';
}

/**
 * Get a short label for the confidence score.
 */
export function getConfidenceLabel(confidence: number | undefined): string {
  if (confidence === undefined) return '—';
  if (confidence >= 0.9) return 'High';
  if (confidence >= 0.7) return 'Medium';
  if (confidence >= 0.5) return 'Low';
  return 'Poor';
}
