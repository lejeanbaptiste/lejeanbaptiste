import { buildDocIndex } from './anchor';
import { createAnchor } from './anchor';
import { chunkDocument, type ChunkOptions } from './chunk';
import type { LlmCache } from './llmCache';
import type { LlmClient } from './llmClient';
import { findOccurrenceOffset, locateInDoc, parseValidItems } from './llmParse';
import { buildSuggestPrompt, SUGGEST_PROMPT_VERSION, suggestionResponseSchema } from './prompts';
import type { Suggestion } from './types';

export interface LlmSuggestOptions extends ChunkOptions {
  tags: string[];
  client: LlmClient;
  cache?: LlmCache;
  /** Called after each chunk finishes (done/total). */
  onProgress?: (done: number, total: number) => void;
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
export async function llmSuggest(doc: Document, options: LlmSuggestOptions): Promise<LlmSuggestResult> {
  const { tags, client, cache, policy, onProgress } = options;
  const chunks = chunkDocument(doc, options);
  const index = buildDocIndex(doc, policy);
  const schema = suggestionResponseSchema(SUGGEST_ACTIONS);

  const suggestions: Suggestion[] = [];
  let unverifiableCount = 0;
  let counter = 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]!;
    let items = (await cache?.get(chunk.text, tags, client.modelId, SUGGEST_PROMPT_VERSION)) ?? null;
    if (!items) {
      const prompt = buildSuggestPrompt({
        tags,
        chunkText: chunk.text,
        before: chunk.before,
        after: chunk.after,
      });
      const response = await client.complete({ ...prompt, jsonSchema: schema });
      items = parseValidItems(response.json, tags, SUGGEST_ACTIONS);
      await cache?.set(chunk.text, tags, client.modelId, SUGGEST_PROMPT_VERSION, items);
    }

    for (const item of items) {
      const offset = findOccurrenceOffset(chunk.text, item.surface, item.occurrence);
      const located = offset === null ? null : locateInDoc(index, chunk.start + offset, item.surface.length);
      if (!located) {
        unverifiableCount++;
        continue;
      }
      suggestions.push({
        id: `ai_${counter++}`,
        source: 'ai',
        sourceDetail: client.modelId,
        action: 'add',
        tag: item.tag,
        anchor: createAnchor('', doc, located.node, located.rawStart, located.rawEnd, policy, index),
        confidence: item.confidence,
        rationale: item.rationale,
        status: 'pending',
      });
    }

    onProgress?.(chunkIndex + 1, chunks.length);
  }

  return { suggestions, unverifiableCount };
}
