import type { LlmClient } from '../autoTagging/llmClient';
import { buildPunctPrompt, AI_PUNCT_PROMPT_VERSION, type PunctPromptSegment } from './prompts';
import { punctuationResponseSchema } from './punctSchema';
import { chunkHanText } from './selectionScope';
import type { RawPunctInsertion, VerifiedPunctInsertion } from './punctSchema';
import { dedupeInsertions, parseValidInsertions, verifySegmentInsertions } from './verifyInsertions';

export interface LlmPunctuateSegmentInput extends PunctPromptSegment {
  han_start: number;
}

export interface LlmPunctuateResult {
  verified: VerifiedPunctInsertion[];
  dropped_schema: number;
  dropped_anchor: number;
}

export async function llmPunctuateSegment(
  segment: LlmPunctuateSegmentInput,
  client: LlmClient,
  signal?: AbortSignal,
): Promise<LlmPunctuateResult> {
  const chunks = chunkHanText(segment.han);
  const allVerified: VerifiedPunctInsertion[] = [];
  let dropped_schema = 0;
  let dropped_anchor = 0;

  for (const chunk of chunks) {
    signal?.throwIfAborted();
    const promptSegment: PunctPromptSegment = {
      kind: segment.kind,
      han: chunk.text,
      preceding_comm: segment.preceding_comm,
      following_comm: segment.following_comm,
    };
    const prompt = buildPunctPrompt(promptSegment, chunk.offset);
    const schema = punctuationResponseSchema();
    const response = await client.complete({ ...prompt, jsonSchema: schema, signal });
    const parsed: RawPunctInsertion[] = parseValidInsertions(response.json);
    let rawCount = 0;
    try {
      const body = JSON.parse(response.json) as { insertions?: unknown[] };
      rawCount = Array.isArray(body.insertions) ? body.insertions.length : 0;
    } catch {
      rawCount = 0;
    }
    dropped_schema += Math.max(0, rawCount - parsed.length);
    const { verified, dropped } = verifySegmentInsertions(
      chunk.text,
      parsed,
      segment.han_start + chunk.offset,
    );
    dropped_anchor += dropped;
    allVerified.push(...verified);
  }

  return {
    verified: dedupeInsertions(allVerified),
    dropped_schema,
    dropped_anchor,
  };
}

export { AI_PUNCT_PROMPT_VERSION };
