import { findOccurrenceOffset } from '../autoTagging/llmParse';
import type { RawPunctInsertion, VerifiedPunctInsertion } from './punctSchema';
import { AI_PUNCT_MARKS } from './punctSchema';

const MARK_SET = new Set<string>(AI_PUNCT_MARKS);
const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

export function parseValidInsertions(json: string): RawPunctInsertion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as any).insertions)) {
    return [];
  }
  const items: RawPunctInsertion[] = [];
  for (const raw of (parsed as { insertions: unknown[] }).insertions) {
    if (typeof raw !== 'object' || raw === null) continue;
    const item = raw as Record<string, unknown>;
    const mark = typeof item.mark === 'string' ? item.mark : '';
    if (!MARK_SET.has(mark)) continue;
    const left = typeof item.left === 'string' ? item.left.trim() : '';
    if (!left.length || left.length > 3) continue;
    if (![...left].every((ch) => HAN_RE.test(ch))) continue;
    const occurrence =
      typeof item.occurrence === 'number' && item.occurrence >= 1
        ? item.occurrence
        : typeof item.occurrence === 'string' && /^[1-9]\d*$/.test(item.occurrence)
          ? Number(item.occurrence)
          : 1;
    items.push({ mark, left, occurrence });
  }
  return items;
}

/** Resolve left+occurrence against segment Han; compute afterHan internally. */
export function verifySegmentInsertions(
  segmentHan: string,
  items: RawPunctInsertion[],
  hanStart: number,
): { verified: VerifiedPunctInsertion[]; dropped: number } {
  const verified: VerifiedPunctInsertion[] = [];
  let dropped = 0;
  for (const item of items) {
    const offset = findOccurrenceOffset(segmentHan, item.left, item.occurrence);
    if (offset === null) {
      dropped++;
      continue;
    }
    const afterHan = offset + item.left.length - 1;
    if (afterHan < 0 || afterHan >= segmentHan.length) {
      dropped++;
      continue;
    }
    verified.push({
      afterHan,
      mark: item.mark,
      global_han: hanStart + afterHan,
    });
  }
  return { verified, dropped };
}

export function dedupeInsertions(items: VerifiedPunctInsertion[]): VerifiedPunctInsertion[] {
  const byKey = new Map<string, VerifiedPunctInsertion>();
  for (const item of items) {
    byKey.set(`${item.global_han}:${item.mark}`, item);
  }
  return [...byKey.values()].sort((a, b) => a.global_han - b.global_han);
}
