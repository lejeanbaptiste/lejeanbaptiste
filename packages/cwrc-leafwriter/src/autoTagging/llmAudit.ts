import { buildDocIndex, createAnchor, type DocIndex } from './anchor';
import { chunkDocument, llmChunkOptions, type Chunk, type ChunkOptions } from './chunk';
import type { LlmCache } from './llmCache';
import type { LlmClient } from './llmClient';
import { findOccurrenceOffset, locateInDoc, parseValidItems } from './llmParse';
import { AUDIT_PROMPT_VERSION, buildAuditPrompt, suggestionResponseSchema } from './prompts';
import type { Suggestion, SuggestionAction } from './types';

export interface LlmAuditOptions extends ChunkOptions {
  /** Tags to audit — both the ones already applied and candidates for 'add'. */
  tags: string[];
  client: LlmClient;
  cache?: LlmCache;
  /** Called after each chunk finishes (done/total). */
  onProgress?: (done: number, total: number) => void;
}

export interface LlmAuditResult {
  suggestions: Suggestion[];
  /** Model-returned items dropped for failing schema or anchor verification — never applied. */
  unverifiableCount: number;
}

const AUDIT_ACTIONS = ['add', 'remove', 'retag', 'redraw-boundary'];

export interface TaggedSpan {
  /** Offsets in the whole-document search text (index.text). */
  start: number;
  end: number;
  tag: string;
}

/**
 * All existing tagged mentions (single-text-node elements) for the given
 * tags, in document order. Also reused by the validation harness to derive
 * gold mentions from a hand-tagged document.
 */
export function collectTaggedSpans(doc: Document, index: DocIndex, tagSet: Set<string>): TaggedSpan[] {
  const walker = doc.createTreeWalker(doc.documentElement ?? doc, NodeFilter.SHOW_ELEMENT);
  const spans: TaggedSpan[] = [];
  let el = walker.nextNode() as Element | null;
  while (el) {
    if (tagSet.has(el.nodeName)) {
      const textChildren = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
      if (textChildren.length === 1) {
        const nodeIdx = index.nodes.findIndex((n) => n.node === textChildren[0]);
        if (nodeIdx !== -1) {
          const start = index.nodeStart[nodeIdx]!;
          const end = start + index.nodes[nodeIdx]!.search.text.length;
          spans.push({ start, end, tag: el.nodeName });
        }
      }
    }
    el = walker.nextNode() as Element | null;
  }
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Render a chunk's plain text with existing tags shown as inline
 * `<TAG>surface</TAG>` markers, so the model can see current boundaries.
 * Returns the rendered string plus a per-character map back to whole-document
 * search-text offsets (the same coordinate space `locateInDoc` expects) —
 * marker-literal characters map to their span's boundary offset since a
 * verified match is never expected to include them.
 */
function renderChunkWithTags(index: DocIndex, chunk: Chunk, spans: TaggedSpan[]): { rendered: string; map: number[] } {
  const relevant = spans.filter((s) => s.start >= chunk.start && s.end <= chunk.end);
  let rendered = '';
  const map: number[] = [];
  let pos = chunk.start;

  const appendPlain = (from: number, to: number) => {
    for (let p = from; p < to; p++) {
      rendered += index.text[p]!;
      map.push(p);
    }
  };

  for (const span of relevant) {
    appendPlain(pos, span.start);
    for (const ch of `<${span.tag}>`) {
      rendered += ch;
      map.push(span.start);
    }
    appendPlain(span.start, span.end);
    for (const ch of `</${span.tag}>`) {
      rendered += ch;
      map.push(span.end);
    }
    pos = span.end;
  }
  appendPlain(pos, chunk.end);

  return { rendered, map };
}

/**
 * AI audit: take a dumb-tagged document, show the model each chunk with its
 * current tags rendered inline, and ask for corrections — keep (no
 * suggestion), add (missed), remove, retag, or redraw-boundary. Every
 * finding is verified against the live document before being turned into a
 * suggestion, exactly like llmSuggest.
 */
export async function llmAudit(doc: Document, options: LlmAuditOptions): Promise<LlmAuditResult> {
  const { tags, client, cache, policy, onProgress } = options;
  const chunks = chunkDocument(doc, llmChunkOptions(options));
  const index = buildDocIndex(doc, policy);
  const tagSet = new Set(tags);
  const spans = collectTaggedSpans(doc, index, tagSet);
  const schema = suggestionResponseSchema(AUDIT_ACTIONS);

  const suggestions: Suggestion[] = [];
  let unverifiableCount = 0;
  let counter = 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]!;
    const { rendered, map } = renderChunkWithTags(index, chunk, spans);

    let items = (await cache?.get(rendered, tags, client.modelId, AUDIT_PROMPT_VERSION)) ?? null;
    if (!items) {
      const prompt = buildAuditPrompt({
        tags,
        taggedChunkText: rendered,
        before: chunk.before,
        after: chunk.after,
      });
      const response = await client.complete({ ...prompt, jsonSchema: schema });
      items = parseValidItems(response.json, tags, AUDIT_ACTIONS);
      await cache?.set(rendered, tags, client.modelId, AUDIT_PROMPT_VERSION, items);
    }

    for (const item of items) {
      const renderedOffset = findOccurrenceOffset(rendered, item.surface, item.occurrence);
      const docOffset = renderedOffset === null ? null : map[renderedOffset]!;
      let located = null;
      try {
        located = docOffset === null ? null : locateInDoc(index, docOffset, item.surface.length);
      } catch {
        located = null;
      }
      if (!located) {
        unverifiableCount++;
        continue;
      }
      try {
        suggestions.push({
          id: `ai_audit_${counter++}`,
          source: 'ai',
          sourceDetail: client.modelId,
          action: item.action as SuggestionAction,
          tag: item.tag,
          anchor: createAnchor('', doc, located.node, located.rawStart, located.rawEnd, policy, index),
          confidence: item.confidence,
          rationale: item.rationale,
          status: 'pending',
        });
      } catch {
        unverifiableCount++;
      }
    }

    onProgress?.(chunkIndex + 1, chunks.length);
  }

  return { suggestions, unverifiableCount };
}
