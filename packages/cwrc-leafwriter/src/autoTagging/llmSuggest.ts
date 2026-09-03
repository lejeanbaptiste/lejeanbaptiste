import type { AiPromptProfile } from './aiPromptProfiles';
import { promptVersionWithProfile, resolveSuggestTaskText } from './aiPromptProfiles';
import { buildDocIndex } from './anchor';
import { createAnchor } from './anchor';
import { chunkDocument, llmChunkOptions, type ChunkOptions } from './chunk';
import { findTeiBodyRoot } from './dateTeiHelpers';
import type { LlmCache } from './llmCache';
import type { LlmClient } from './llmClient';
import { findOccurrenceMatch, locateInDoc, parseValidItems } from './llmParse';
import { buildSuggestPrompt, SUGGEST_PROMPT_VERSION, suggestionResponseSchema } from './prompts';
import type { Suggestion } from './types';

export interface LlmSuggestOptions extends ChunkOptions {
  tags: string[];
  client: LlmClient;
  cache?: LlmCache;
  promptProfile?: AiPromptProfile;
  /** Called after each chunk finishes (done/total). */
  onProgress?: (done: number, total: number) => void;
  /** Suggestions verified from one completed document chunk. */
  onChunk?: (suggestions: Suggestion[]) => void;
  /** Stops between chunks and aborts the in-flight request when triggered. */
  signal?: AbortSignal;
  /**
   * Tibetan projects: when a surface fails an exact match, retry it with the
   * non-breaking tsheg folded and edge tsheg/shad trimmed (see
   * `findOccurrenceMatch`). Off for CJK, where those marks do not occur.
   */
  tibetanTolerant?: boolean;
}

export interface LlmSuggestResult {
  suggestions: Suggestion[];
  /** Model-returned items dropped for failing schema or anchor verification — never applied. */
  unverifiableCount: number;
}

const SUGGEST_ACTIONS = ['add'];

/**
 * AI suggest: chunk the document, ask the model to find mentions of the
 * requested tags in each chunk, verify every claim against the live
 * document (surface + occurrence, not offsets), and emit plain 'add'
 * suggestions through the same review walk as every other producer.
 */
export async function llmSuggest(
  doc: Document,
  options: LlmSuggestOptions,
): Promise<LlmSuggestResult> {
  const { tags, client, cache, policy, onProgress, onChunk, promptProfile, signal } = options;
  const root = options.root ?? findTeiBodyRoot(doc);
  const chunks = chunkDocument(doc, llmChunkOptions({ ...options, root }));
  const index = buildDocIndex(root, policy);
  const schema = suggestionResponseSchema(SUGGEST_ACTIONS);
  const promptVersion = promptVersionWithProfile(SUGGEST_PROMPT_VERSION, promptProfile);
  const suggestTaskText = resolveSuggestTaskText(promptProfile);

  const suggestions: Suggestion[] = [];
  let unverifiableCount = 0;
  let counter = 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    signal?.throwIfAborted();
    const chunk = chunks[chunkIndex]!;
    let items = (await cache?.get(chunk.text, tags, client.modelId, promptVersion)) ?? null;
    if (!items) {
      const prompt = buildSuggestPrompt({
        tags,
        chunkText: chunk.text,
        before: chunk.before,
        after: chunk.after,
        suggestTaskText,
      });
      const response = await client.complete({ ...prompt, jsonSchema: schema, signal });
      items = parseValidItems(response.json, tags, SUGGEST_ACTIONS);
      await cache?.set(chunk.text, tags, client.modelId, promptVersion, items);
    }

    const chunkSuggestions: Suggestion[] = [];
    for (const item of items) {
      const match = findOccurrenceMatch(chunk.text, item.surface, item.occurrence, {
        tibetanTolerant: options.tibetanTolerant,
      });
      const located =
        match === null ? null : locateInDoc(index, chunk.start + match.offset, match.length);
      if (!located) {
        unverifiableCount++;
        continue;
      }
      const suggestion: Suggestion = {
        id: `ai_${counter++}`,
        source: 'ai',
        sourceDetail: client.modelId,
        action: 'add',
        tag: item.tag,
        anchor: createAnchor(
          '',
          root,
          located.node,
          located.rawStart,
          located.rawEnd,
          policy,
          index,
        ),
        confidence: item.confidence,
        rationale: item.rationale,
        status: 'pending',
      };
      suggestions.push(suggestion);
      chunkSuggestions.push(suggestion);
    }

    if (chunkSuggestions.length > 0) onChunk?.(chunkSuggestions);
    onProgress?.(chunkIndex + 1, chunks.length);
  }

  return { suggestions, unverifiableCount };
}
