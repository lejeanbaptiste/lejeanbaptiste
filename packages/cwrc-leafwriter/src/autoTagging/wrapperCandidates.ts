import { compareAnchorsByDocumentPosition } from './anchor';
import { PERSON_WRAPPER_CHILD_ORDER } from './personWrapperValidation';
import { dedupeSourceLabels } from './seed';
import type { Anchor, Suggestion } from './types';

/**
 * Groups fully contiguous, canonically-ordered runs of pending person-wrapper
 * component suggestions (nationality → roleName → nobleTitle → placeName →
 * persName, see `PERSON_WRAPPER_CHILD_ORDER`) into synthetic wrapper-candidate
 * suggestions, before anything is applied to the document. This is the
 * suggestion-level counterpart to `createPersonWrappersInScope`
 * (`groupAndClean.ts`), which does the same grouping but only after
 * components already exist as DOM elements.
 *
 * "Contiguous" means zero gap of any kind — not even whitespace or
 * punctuation — between one suggestion's end and the next one's start.
 * Adjacency with a gap does not count; a run simply stops there. A component
 * of the same slot may repeat within a run (e.g. two `roleName`s in a row,
 * a person holding two offices) since repeats never violate the relative
 * order. A run must end in `persName` and contain at least one other
 * component to be grouped — a lone `persName` is left untouched, same as
 * `createPersonWrappersInScope`.
 */

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const WRAPPER_TAGS = new Set(Object.keys(PERSON_WRAPPER_CHILD_ORDER));

function isWrapperComponentSuggestion(suggestion: Suggestion): boolean {
  return (
    suggestion.status === 'pending' &&
    suggestion.action === 'add' &&
    WRAPPER_TAGS.has(suggestion.tag)
  );
}

/** The end of a suggestion's anchored span — its own end for a compound anchor, else start + surface length. */
function anchorEnd(anchor: Anchor): { xpath: string; offset: number } {
  if (anchor.endXpath != null && anchor.endOffset != null) {
    return { xpath: anchor.endXpath, offset: anchor.endOffset };
  }
  return { xpath: anchor.xpath, offset: anchor.offset + anchor.surface.length };
}

/** True when `next` begins exactly where `prev` ends — no gap, not even whitespace. */
function isContiguous(prev: Suggestion, next: Suggestion): boolean {
  const end = anchorEnd(prev.anchor);
  return end.xpath === next.anchor.xpath && end.offset === next.anchor.offset;
}

function componentXml(suggestion: Suggestion): string {
  const inner = suggestion.innerXml ?? xmlEscape(suggestion.anchor.surface);
  const attrs = suggestion.attributes
    ? Object.entries(suggestion.attributes)
        .map(([key, value]) => ` ${key}="${xmlEscape(value)}"`)
        .join('')
    : '';
  return `<${suggestion.tag}${attrs}>${inner}</${suggestion.tag}>`;
}

function buildWrapperCandidateSuggestion(run: readonly Suggestion[]): Suggestion {
  const first = run[0]!;
  const last = run[run.length - 1]!;
  const end = anchorEnd(last.anchor);
  const surface = run.map((suggestion) => suggestion.anchor.surface).join('');
  const innerXml = run.map(componentXml).join('');

  return {
    id: `wrapper_candidate_${first.id}`,
    source: 'authority',
    sourceDetail: dedupeSourceLabels(
      run.map((suggestion) => suggestion.sourceDetail ?? suggestion.source),
    ).join('+'),
    action: 'add-compound',
    tag: 'name',
    attributes: { type: 'personWrapper', cert: 'unknown' },
    innerXml,
    anchor: {
      ...first.anchor,
      surface,
      endXpath: end.xpath,
      endOffset: end.offset,
    },
    rationale: `Contiguous person-wrapper candidate (${run.map((suggestion) => suggestion.tag).join(' → ')})`,
    status: 'pending',
    compoundMembers: [...run],
  };
}

export interface WrapperCandidateGroup {
  /** The synthetic wrapper-candidate suggestion, ready for review. */
  suggestion: Suggestion;
  /** The original component suggestions it consumes, in document order. */
  members: Suggestion[];
}

export interface GroupWrapperCandidatesResult {
  /** One synthetic suggestion per contiguous, canonically-ordered run found. */
  groups: WrapperCandidateGroup[];
  /** Every suggestion not consumed by a group, in its original order. */
  ungrouped: Suggestion[];
}

/**
 * Scan a pending suggestion batch for wrapper candidates. Assumes the caller
 * has already deduped one suggestion per (location, tag) — this does not
 * itself resolve suggestions competing for the same span.
 */
export function groupWrapperCandidateSuggestions(
  suggestions: readonly Suggestion[],
): GroupWrapperCandidatesResult {
  const candidates = suggestions
    .filter(isWrapperComponentSuggestion)
    .slice()
    .sort((a, b) => compareAnchorsByDocumentPosition(a.anchor, b.anchor));

  const consumed = new Set<string>();
  const groups: WrapperCandidateGroup[] = [];

  let i = 0;
  while (i < candidates.length) {
    const run: Suggestion[] = [candidates[i]!];
    let j = i + 1;
    while (j < candidates.length) {
      const last = run[run.length - 1]!;
      // persName is always the terminal component — nothing may follow it.
      if (last.tag === 'persName') break;
      const next = candidates[j]!;
      if (!isContiguous(last, next)) break;
      if (PERSON_WRAPPER_CHILD_ORDER[next.tag]! < PERSON_WRAPPER_CHILD_ORDER[last.tag]!) break;
      run.push(next);
      j++;
    }

    const endsInPersName = run[run.length - 1]!.tag === 'persName';
    if (endsInPersName && run.length > 1) {
      groups.push({ suggestion: buildWrapperCandidateSuggestion(run), members: run });
      for (const member of run) consumed.add(member.id);
      i = j;
    } else {
      i += 1;
    }
  }

  const ungrouped = suggestions.filter((suggestion) => !consumed.has(suggestion.id));
  return { groups, ungrouped };
}
