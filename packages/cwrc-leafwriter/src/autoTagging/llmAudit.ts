import type { AiPromptProfile } from './aiPromptProfiles';
import { promptVersionWithProfile, resolveAuditCleanTaskText } from './aiPromptProfiles';
import { buildDocIndex, createAnchor, type DocIndex } from './anchor';
import { applySuggestions } from './apply';
import { chunkDocument, llmChunkOptions, type Chunk, type ChunkOptions } from './chunk';
import type { LlmCache } from './llmCache';
import type { LlmClient } from './llmClient';
import { findOccurrenceOffset, locateInDoc, parseValidItems } from './llmParse';
import { llmSuggest } from './llmSuggest';
import {
  AUDIT_CLEAN_PROMPT_VERSION,
  buildAuditCleanPrompt,
  suggestionResponseSchema,
} from './prompts';
import type { Suggestion, SuggestionAction } from './types';

export interface LlmAuditOptions extends ChunkOptions {
  /** Tags to audit — both the ones already applied and candidates for 'add'. */
  tags: string[];
  client: LlmClient;
  cache?: LlmCache;
  promptProfile?: AiPromptProfile;
  /** Called after each chunk finishes (done/total). Total spans clean + suggest passes. */
  onProgress?: (done: number, total: number) => void;
  /** Suggestions verified from one completed document chunk. */
  onChunk?: (suggestions: Suggestion[]) => void;
  /** Stops between chunks and aborts the in-flight request when triggered. */
  signal?: AbortSignal;
}

export interface LlmAuditResult {
  suggestions: Suggestion[];
  /** Model-returned items dropped for failing schema, anchor verification, or overlap — never applied. */
  unverifiableCount: number;
  cleanSuggestionCount: number;
  addSuggestionCount: number;
}

const CLEAN_ACTIONS = ['remove', 'retag', 'redraw-boundary'];

export interface TaggedSpan {
  start: number;
  end: number;
  tag: string;
}

export function collectTaggedSpans(
  doc: Document,
  index: DocIndex,
  tagSet: Set<string>,
): TaggedSpan[] {
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

function currentTagAt(spans: TaggedSpan[], docStart: number, docEnd: number): string | null {
  const exact = spans.find((s) => s.start === docStart && s.end === docEnd);
  if (exact) return exact.tag;
  const enclosing = spans.find((s) => s.start <= docStart && s.end >= docEnd);
  return enclosing?.tag ?? null;
}

function renderChunkWithTags(
  index: DocIndex,
  chunk: Chunk,
  spans: TaggedSpan[],
): { rendered: string; map: number[] } {
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

const suggestionDedupeKey = (action: string, tag: string, surface: string, occurrence: number) =>
  `${action}\0${tag}\0${surface}\0${occurrence}`;

function dedupeSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of suggestions) {
    const key = suggestionDedupeKey(s.action, s.tag, s.anchor.surface, s.anchor.occurrence);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

async function runAuditCleanPass(
  doc: Document,
  options: LlmAuditOptions,
  progressOffset: number,
  progressTotal: number,
): Promise<{ suggestions: Suggestion[]; unverifiableCount: number }> {
  const { tags, client, cache, policy, onProgress, onChunk, promptProfile, signal } = options;
  const chunks = chunkDocument(doc, llmChunkOptions(options));
  const index = buildDocIndex(doc, policy);
  const tagSet = new Set(tags);
  const spans = collectTaggedSpans(doc, index, tagSet);
  const schema = suggestionResponseSchema(CLEAN_ACTIONS);
  const promptVersion = promptVersionWithProfile(AUDIT_CLEAN_PROMPT_VERSION, promptProfile);
  const auditCleanTaskText = resolveAuditCleanTaskText(promptProfile);

  const suggestions: Suggestion[] = [];
  let unverifiableCount = 0;
  let counter = 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    signal?.throwIfAborted();
    const chunk = chunks[chunkIndex]!;
    const { rendered, map } = renderChunkWithTags(index, chunk, spans);

    let items = (await cache?.get(rendered, tags, client.modelId, promptVersion)) ?? null;
    if (!items) {
      const prompt = buildAuditCleanPrompt({
        tags,
        taggedChunkText: rendered,
        before: chunk.before,
        after: chunk.after,
        auditCleanTaskText,
      });
      const response = await client.complete({ ...prompt, jsonSchema: schema, signal });
      items = parseValidItems(response.json, tags, CLEAN_ACTIONS);
      await cache?.set(rendered, tags, client.modelId, promptVersion, items);
    }

    const chunkSuggestions: Suggestion[] = [];
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

      const docStart = docOffset!;
      const docEnd = docStart + item.surface.length;

      if (item.action === 'retag') {
        const currentTag = currentTagAt(spans, docStart, docEnd);
        if (currentTag === item.tag) {
          unverifiableCount++;
          continue;
        }
      }

      try {
        const suggestion: Suggestion = {
          id: `ai_audit_clean_${counter++}`,
          source: 'ai',
          sourceDetail: client.modelId,
          action: item.action as SuggestionAction,
          tag: item.tag,
          anchor: createAnchor(
            '',
            doc,
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
      } catch {
        unverifiableCount++;
      }
    }

    if (chunkSuggestions.length > 0) onChunk?.(chunkSuggestions);
    onProgress?.(progressOffset + chunkIndex + 1, progressTotal);
  }

  return { suggestions, unverifiableCount };
}

/** Clean pass only — remove, retag, redraw-boundary. */
export async function llmAuditClean(
  doc: Document,
  options: LlmAuditOptions,
): Promise<LlmAuditResult> {
  const chunks = chunkDocument(doc, llmChunkOptions(options));
  const { suggestions, unverifiableCount } = await runAuditCleanPass(
    doc,
    options,
    0,
    chunks.length,
  );
  const deduped = dedupeSuggestions(suggestions);
  return {
    suggestions: deduped,
    unverifiableCount,
    cleanSuggestionCount: deduped.length,
    addSuggestionCount: 0,
  };
}

/** Add pass — suggest.v3 on plain chunks. */
export async function llmAuditAdd(
  doc: Document,
  options: LlmAuditOptions,
): Promise<LlmAuditResult> {
  const suggestResult = await llmSuggest(doc, options);
  const deduped = dedupeSuggestions(suggestResult.suggestions);
  return {
    suggestions: deduped,
    unverifiableCount: suggestResult.unverifiableCount,
    cleanSuggestionCount: 0,
    addSuggestionCount: deduped.length,
  };
}

/**
 * AI audit: (1) clean pass on tagged inline chunks, (2) apply clean in memory,
 * (3) suggest pass for missed mentions on plain text. Matches the validation harness.
 */
export async function llmAudit(doc: Document, options: LlmAuditOptions): Promise<LlmAuditResult> {
  const chunks = chunkDocument(doc, llmChunkOptions(options));
  const total = chunks.length * 2;

  const clean = await runAuditCleanPass(doc, options, 0, total);

  const working = doc.cloneNode(true) as Document;
  await applySuggestions(working, clean.suggestions, { policy: options.policy });

  const addResult = await llmSuggest(working, {
    ...options,
    onProgress: (done, _chunkTotal) => options.onProgress?.(chunks.length + done, total),
    onChunk: options.onChunk,
  });

  const merged = dedupeSuggestions([...clean.suggestions, ...addResult.suggestions]);

  return {
    suggestions: merged,
    unverifiableCount: clean.unverifiableCount + addResult.unverifiableCount,
    cleanSuggestionCount: clean.suggestions.length,
    addSuggestionCount: addResult.suggestions.length,
  };
}
