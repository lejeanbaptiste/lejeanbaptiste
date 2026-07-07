import { extractDocumentDateRange } from './documentDateRange';
import type { DisambiguationCandidate } from './disambiguationCandidates';
import type { MentionInstance } from './mentions';

const BLOCK_TAGS = new Set(['p', 'div', 'l', 'lg', 'ab', 'item', 'head']);

export interface CoMentionedName {
  surface: string;
  tag: string;
  entityKey?: string;
}

export interface DisambiguationRankContext {
  tag: string;
  surface: string;
  contextBefore: string;
  contextAfter: string;
  documentDateRange: { start: number; end: number } | null;
  coMentionedNames: CoMentionedName[];
  candidates: DisambiguationCandidate[];
}

function blockAncestor(element: Element): Element {
  for (let cur: Element | null = element; cur; cur = cur.parentElement) {
    if (BLOCK_TAGS.has(cur.localName)) return cur;
  }
  return element;
}

/** Other named-entity tags in the same block as this mention (e.g. co-occurring persName). */
export function coMentionedNamesInBlock(instance: MentionInstance): CoMentionedName[] {
  const block = blockAncestor(instance.element);
  const out: CoMentionedName[] = [];
  const seen = new Set<string>();

  const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.nextNode() as Element | null; el; el = walker.nextNode() as Element | null) {
    if (el === instance.element) continue;
    const tag = el.localName;
    if (tag !== 'persName' && tag !== 'placeName' && tag !== 'orgName') continue;
    const surface = (el.textContent ?? '').trim();
    if (!surface) continue;
    const key = `${tag}\0${surface}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entityKey = el.getAttribute('key')?.trim() || undefined;
    out.push({ surface, tag, entityKey });
  }

  return out;
}

export function buildDisambiguationRankContext(
  doc: Document,
  instance: MentionInstance,
  candidates: DisambiguationCandidate[],
): DisambiguationRankContext {
  return {
    tag: instance.tag,
    surface: instance.surface,
    contextBefore: instance.anchor.contextBefore,
    contextAfter: instance.anchor.contextAfter,
    documentDateRange: extractDocumentDateRange(doc),
    coMentionedNames: coMentionedNamesInBlock(instance),
    candidates,
  };
}

export function formatDisambiguationRankContext(ctx: DisambiguationRankContext): string {
  const lines: string[] = [
    `Tag: ${ctx.tag}`,
    `Surface: ${ctx.surface}`,
    `Context: …${ctx.contextBefore}【${ctx.surface}】${ctx.contextAfter}…`,
  ];

  if (ctx.documentDateRange) {
    lines.push(
      `Document date span (from tagged <date> elements): ${ctx.documentDateRange.start}–${ctx.documentDateRange.end} CE`,
    );
  } else {
    lines.push('Document date span: none resolved in this document');
  }

  if (ctx.coMentionedNames.length > 0) {
    lines.push(
      'Co-mentioned names in the same paragraph/block:',
      ...ctx.coMentionedNames.map((name) => {
        const keyNote = name.entityKey ? ` @key=${name.entityKey}` : '';
        return `- <${name.tag}>${name.surface}${keyNote}`;
      }),
    );
  } else {
    lines.push('Co-mentioned names in the same paragraph/block: (none)');
  }

  lines.push('Candidates (use exact id when selecting):');
  for (const candidate of ctx.candidates) {
    const desc = candidate.description ? ` — ${candidate.description}` : '';
    const sources = candidate.sources.length ? ` [${candidate.sources.join(', ')}]` : '';
    lines.push(`- id=${candidate.id}: ${candidate.label}${desc}${sources}`);
  }

  return lines.join('\n');
}
