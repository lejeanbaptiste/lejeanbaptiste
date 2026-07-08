import type { AiPromptProfile } from './aiPromptProfiles';
import {
  DEFAULT_VALIDATION_TASK_TEXT,
  resolveValidationTaskText,
} from './aiPromptProfiles';
import type { AiValidationResult, Suggestion } from './types';
import type { LlmClient } from './llmClient';
import type { ChunkOptions } from './chunk';

/**
 * Validates suggestions using LLM to identify incorrect tags and pre-select
 * the best candidate when multiple tags match the same surface.
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
 * Single validation result from LLM for a suggestion or group of alternatives.
 */
export interface RawValidationResult {
  /** Suggestion ID or group identifier. */
  id: string;
  /** Validation confidence score (0-1). */
  confidence: number;
  /** Warning message if AI flags this as incorrect. */
  warning?: string;
  /** True if AI recommends this suggestion. */
  recommended: boolean;
  /** For multi-tag alternatives: the preferred tag. */
  preferredTag?: string;
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
          preferredTag: { type: 'string' },
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
    `Validate the following auto-tagging suggestions for ${langLabel}historical texts. For each suggestion, assess:`,
    '1. Whether the tag is semantically correct for the surface string in its local context',
    '2. Whether the boundary spans are accurate',
    '3. If multiple tags are proposed for the same surface, pick the most appropriate one',
    '',
    'Suggestions (use exact id in your response):',
  ];

  for (const s of params.suggestions) {
    const ruleNotes = params.schemaRules.length > 0
      ? `\n  Schema notes: ${params.schemaRules.join(', ')}`
      : '';
    const localContext = `…${s.anchor.contextBefore}【${s.anchor.surface}】${s.anchor.contextAfter}…`;
    lines.push(
      `- id=${s.id}: tag=<${s.tag}>, surface="${s.anchor.surface}", action=${s.action}` +
        (s.confidence !== undefined ? `, confidence=${s.confidence.toFixed(2)}` : '') +
        `\n  Context: ${localContext}` +
        ruleNotes,
    );
  }

  lines.push('');
  lines.push('Respond with a JSON object containing a "validations" array.');
  lines.push('Each validation must include: id, confidence (0-1), recommended (boolean), and optionally warning, preferredTag, rationale.');

  return lines.join('\n');
}

/**
 * Group suggestions by their anchor position for batch validation.
 * Same-span alternatives (same surface + occurrence) are grouped together.
 */
function groupSuggestionsBySpan(suggestions: Suggestion[]): Map<string, Suggestion[]> {
  const groups = new Map<string, Suggestion[]>();
  for (const s of suggestions) {
    const key = `${s.anchor.surface}\0${s.anchor.occurrence}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(s);
  }
  return groups;
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

    const confidence = typeof v.confidence === 'number' && v.confidence >= 0 && v.confidence <= 1
      ? v.confidence
      : 0.5;

    const warning = typeof v.warning === 'string' && v.warning.trim() !== '' ? v.warning.trim() : undefined;
    const recommended = v.recommended === true;
    const preferredTag = typeof v.preferredTag === 'string' && v.preferredTag.trim() !== ''
      ? v.preferredTag.trim()
      : undefined;
    const rationale = typeof v.rationale === 'string' && v.rationale.trim() !== ''
      ? v.rationale.trim()
      : undefined;

    result.set(id, {
      confidence,
      warning,
      recommended,
      preferredTag,
      rationale,
      validatedAt: new Date().toISOString(),
    });
  }

  return result;
}

/**
 * Validate a batch of suggestions using LLM.
 * Groups same-span alternatives together for joint validation.
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
  } = options;

  if (suggestions.length === 0) {
    return new Map();
  }

  const groups = groupSuggestionsBySpan(suggestions);
  const result = new Map<string, AiValidationResult>();

  const taskText = resolveValidationTaskText(promptProfile);
  const batches = chunkSuggestions(suggestions, Math.max(1, batchSize));

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    const batchIds = new Set(batch.map((s) => s.id));
    const userPrompt = buildValidationUserPrompt({
      suggestions: batch,
      schemaRules,
      language,
    });

    if (i > 0) await sleep(BATCH_PACING_MS);

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
    } catch (error) {
      // Silent fail per batch - one failed batch shouldn't stop the rest.
      console.warn('AI validation batch failed:', error);
    }

    onProgress?.(i + 1, batches.length);
  }

  // For grouped alternatives, propagate preferredTag to all members.
  for (const groupSuggestions of groups.values()) {
    if (groupSuggestions.length <= 1) continue;

    let preferredTag: string | undefined;
    for (const s of groupSuggestions) {
      const validation = result.get(s.id);
      if (validation?.preferredTag) {
        preferredTag = validation.preferredTag;
        break;
      }
    }

    if (preferredTag) {
      for (const s of groupSuggestions) {
        const existing = result.get(s.id);
        result.set(s.id, {
          confidence: existing?.confidence ?? 0.5,
          recommended: existing?.recommended ?? false,
          warning: existing?.warning,
          preferredTag,
          rationale: existing?.rationale,
          validatedAt: existing?.validatedAt,
        });
      }
    }
  }

  return result;
}

/**
 * Get validation confidence color for display.
 */
export function getValidationColor(confidence: number | undefined): 'error' | 'warning' | 'success' | 'default' {
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
