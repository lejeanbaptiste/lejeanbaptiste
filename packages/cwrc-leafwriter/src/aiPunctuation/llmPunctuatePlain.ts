import type { LlmClient } from '../autoTagging/llmClient';
import { buildPlainPunctPrompt, stripPlainPunctResponse, type PunctPromptSegment } from './prompts';
import { PLAIN_CHUNK_HAN } from './punctSchema';

export interface LlmPunctuatePlainSegmentInput extends PunctPromptSegment {
  han_start: number;
}

interface HanChunk {
  text: string;
  offset: number;
}

function chunkHanPlainText(han: string, maxLen = PLAIN_CHUNK_HAN): HanChunk[] {
  if (han.length <= maxLen) {
    return [{ text: han, offset: 0 }];
  }
  const chunks: HanChunk[] = [];
  let start = 0;
  while (start < han.length) {
    let end = Math.min(start + maxLen, han.length);
    if (end < han.length) {
      const window = han.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf('。'),
        window.lastIndexOf('！'),
        window.lastIndexOf('？'),
      );
      if (breakAt > maxLen * 0.35) {
        end = start + breakAt + 1;
      }
    }
    chunks.push({ text: han.slice(start, end), offset: start });
    if (end >= han.length) break;
    start = end;
  }
  return chunks;
}

export async function llmPunctuatePlainSegment(
  segment: LlmPunctuatePlainSegmentInput,
  client: LlmClient,
  signal?: AbortSignal,
): Promise<{ plainText: string }> {
  const chunks = chunkHanPlainText(segment.han);
  const parts: string[] = [];
  for (const chunk of chunks) {
    signal?.throwIfAborted();
    const prompt = buildPlainPunctPrompt({
      kind: segment.kind,
      han: chunk.text,
      preceding_comm: chunk.offset === 0 ? segment.preceding_comm : undefined,
      following_comm:
        chunk.offset + chunk.text.length >= segment.han.length ? segment.following_comm : undefined,
    });
    const response = await client.complete({ ...prompt, signal });
    parts.push(stripPlainPunctResponse(response.json));
  }
  return { plainText: parts.join('') };
}
