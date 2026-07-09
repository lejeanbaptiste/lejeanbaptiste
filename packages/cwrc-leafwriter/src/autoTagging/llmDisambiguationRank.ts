import type { AiPromptProfile } from './aiPromptProfiles';
import {
  promptVersionWithProfile,
  resolveDisambiguationRankTaskText,
} from './aiPromptProfiles';
import { injectPlaceholder } from './prompts';
import rankSystemTemplate from './prompt-templates/disambiguation-rank.system.txt';
import versions from './prompt-templates/versions.json';
import {
  buildDisambiguationRankContext,
  formatDisambiguationRankContext,
} from './disambiguationContext';
import type { DisambiguationAiCache, DisambiguationAiRankResult } from './disambiguationAiCache';
import type { DisambiguationCandidate } from './disambiguationCandidates';
import type { LlmClient, RateLimitRetryInfo } from './llmClient';
import type { MentionInstance } from './mentions';

export const DISAMBIGUATION_RANK_PROMPT_VERSION = versions['disambiguation-rank'];

const responseSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    selectedCandidateIds: { type: 'array', items: { type: 'string' } },
    rationales: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    confidences: {
      type: 'object',
      additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
    },
    suggestCreateNew: { type: 'boolean' },
    createNewRationale: { type: 'string' },
  },
  required: ['selectedCandidateIds', 'rationales', 'confidences', 'suggestCreateNew'],
  additionalProperties: false,
};

function parseRankResponse(
  json: string,
  validIds: Set<string>,
): DisambiguationAiRankResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const body = parsed as Record<string, unknown>;

  const rawIds = Array.isArray(body.selectedCandidateIds) ? body.selectedCandidateIds : [];
  const selectedCandidateIds = rawIds.filter(
    (id): id is string => typeof id === 'string' && validIds.has(id),
  );

  const rationales: Record<string, string> = {};
  if (body.rationales && typeof body.rationales === 'object') {
    for (const [id, line] of Object.entries(body.rationales as Record<string, unknown>)) {
      if (typeof line === 'string' && selectedCandidateIds.includes(id)) {
        rationales[id] = line.trim();
      }
    }
  }

  const confidences: Record<string, number> = {};
  if (body.confidences && typeof body.confidences === 'object') {
    for (const [id, value] of Object.entries(body.confidences as Record<string, unknown>)) {
      if (
        typeof value === 'number' &&
        value >= 0 &&
        value <= 1 &&
        selectedCandidateIds.includes(id)
      ) {
        confidences[id] = value;
      }
    }
  }

  const suggestCreateNew = body.suggestCreateNew === true;
  const createNewRationale =
    typeof body.createNewRationale === 'string' ? body.createNewRationale.trim() : undefined;

  return {
    selectedCandidateIds,
    rationales,
    confidences,
    suggestCreateNew: suggestCreateNew && selectedCandidateIds.length === 0,
    createNewRationale,
  };
}

export async function rankDisambiguationCandidates(options: {
  doc: Document;
  instance: MentionInstance;
  candidates: DisambiguationCandidate[];
  client: LlmClient;
  cache?: DisambiguationAiCache | null;
  promptProfile?: AiPromptProfile | null;
  onRateLimitRetry?: (info: RateLimitRetryInfo) => void;
}): Promise<DisambiguationAiRankResult | null> {
  const { doc, instance, candidates, client, cache, promptProfile, onRateLimitRetry } = options;
  if (candidates.length === 0) return null;

  const ctx = buildDisambiguationRankContext(doc, instance, candidates);
  const user = formatDisambiguationRankContext(ctx);
  const validIds = new Set(candidates.map((c) => c.id));
  const candidateIds = candidates.map((c) => c.id);
  const promptVersion = promptVersionWithProfile(
    DISAMBIGUATION_RANK_PROMPT_VERSION,
    promptProfile,
  );
  const taskTextTemplate = resolveDisambiguationRankTaskText(promptProfile) ?? rankSystemTemplate.trimStart();
  const taskText = injectPlaceholder(
    taskTextTemplate,
    '\n- Use @key only for disambiguation; do not resolve or prefer @ref in this step.',
  );

  const cacheKey = cache?.cacheKey(
    instance.tag,
    instance.surface,
    candidateIds,
    user,
    client.modelId,
    promptVersion,
  );

  if (cacheKey) {
    const hit = await cache!.get(cacheKey);
    if (hit) return hit;
  }

  const response = await client.complete({
    system: taskText,
    user,
    jsonSchema: responseSchema,
    onRateLimitRetry,
  });

  const result = parseRankResponse(response.json, validIds);
  if (!result) return null;

  if (cacheKey && cache) {
    await cache.set(cacheKey, client.modelId, promptVersion, result);
  }

  return result;
}
