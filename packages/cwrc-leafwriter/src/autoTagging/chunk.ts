import { buildDocIndex, type DocIndex } from './anchor';
import type { WhitespacePolicy } from './types';

/** Block-level elements used as chunk-cut points. Never cut inside one. */
export const DEFAULT_BLOCK_TAGS = ['p', 'div', 'l', 'lg', 'head', 'ab', 'item'];

export interface ChunkOptions {
  policy: WhitespacePolicy;
  /** Target size (search-text chars) of the taggable span per chunk. */
  targetChars?: number;
  /** Read-only context margin included before/after the taggable span. */
  marginChars?: number;
  blockTags?: string[];
  /**
   * When set, pack at most this many leaf block elements per chunk (e.g. 1 =
   * one `<p>` at a time). Overrides `targetChars` packing across blocks.
   */
  maxBlocksPerChunk?: number;
}

/** Default for AI suggest/audit — one leaf block per request to stay under provider TPM limits. */
export const LLM_MAX_BLOCKS_PER_CHUNK = 1;

/** Chunk options for LLM producers: one `<p>` (leaf block) per API call unless overridden. */
export function llmChunkOptions(options: ChunkOptions): ChunkOptions {
  return {
    ...options,
    maxBlocksPerChunk: options.maxBlocksPerChunk ?? LLM_MAX_BLOCKS_PER_CHUNK,
  };
}

export interface Chunk {
  id: string;
  /** Offset range in the whole-document search text (index.text) this chunk owns for tagging. */
  start: number;
  end: number;
  /** The taggable text. */
  text: string;
  /** Context-only text — must never be tagged against, only used to disambiguate meaning. */
  before: string;
  after: string;
}

interface BlockRange {
  start: number;
  end: number;
}

/**
 * Split a document into non-overlapping, structurally-bounded chunks (never
 * cutting inside a block element) plus a read-only context margin around
 * each. Non-overlapping ownership keeps occurrence counting unambiguous:
 * every offset in the document belongs to exactly one chunk's taggable span.
 * Falls back to a single whole-document chunk when no recognized block
 * elements are present.
 */
export function chunkDocument(doc: Document, options: ChunkOptions): Chunk[] {
  const {
    policy,
    targetChars = 3000,
    marginChars = 200,
    blockTags = DEFAULT_BLOCK_TAGS,
    maxBlocksPerChunk,
  } = options;
  const index = buildDocIndex(doc, policy);
  if (index.text.length === 0) return [];

  const blocks = collectBlockRanges(doc, index, new Set(blockTags.map((t) => t.toLowerCase())));
  const ranges = blocks.length > 0 ? blocks : [{ start: 0, end: index.text.length }];

  const chunks: Chunk[] = [];
  let i = 0;
  let counter = 0;
  while (i < ranges.length) {
    const start = ranges[i]!.start;
    let end = ranges[i]!.end;
    let j = i + 1;
    if (maxBlocksPerChunk !== undefined) {
      while (j < ranges.length && j - i < maxBlocksPerChunk) {
        end = ranges[j]!.end;
        j++;
      }
    } else {
      while (j < ranges.length && ranges[j]!.end - start <= targetChars) {
        end = ranges[j]!.end;
        j++;
      }
    }
    chunks.push({
      id: `chunk_${counter++}`,
      start,
      end,
      text: index.text.slice(start, end),
      before: index.text.slice(Math.max(0, start - marginChars), start),
      after: index.text.slice(end, Math.min(index.text.length, end + marginChars)),
    });
    i = j;
  }
  return chunks;
}

/**
 * Text-offset ranges of leaf block elements (blocks with no descendant block
 * element, so a <div> wrapping <p>s contributes its <p> ranges, not its own).
 * Ranges are in document order and mutually exclusive.
 */
function collectBlockRanges(doc: Document, index: DocIndex, blockSet: Set<string>): BlockRange[] {
  const isBlock = (el: Element) => blockSet.has(el.nodeName.toLowerCase());
  const walker = doc.createTreeWalker(doc.documentElement ?? doc, NodeFilter.SHOW_ELEMENT);

  const leafBlocks: Element[] = [];
  let node = walker.nextNode() as Element | null;
  while (node) {
    if (isBlock(node) && !Array.from(node.querySelectorAll('*')).some(isBlock)) {
      leafBlocks.push(node);
    }
    node = walker.nextNode() as Element | null;
  }

  const ranges: BlockRange[] = [];
  for (const el of leafBlocks) {
    const nodeIndices = index.nodes
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => el.contains(n.node));
    if (nodeIndices.length === 0) continue;
    const first = nodeIndices[0]!;
    const last = nodeIndices[nodeIndices.length - 1]!;
    const start = index.nodeStart[first.i]!;
    const end = index.nodeStart[last.i]! + last.n.search.text.length;
    ranges.push({ start, end });
  }

  // Merge/sort defensively — leaf blocks are already in document order via
  // the tree walker, but guard against any adjacency gaps from skipped nodes.
  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}
