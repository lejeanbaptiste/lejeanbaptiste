/**
 * Commits a parsed noble-title span into the live editor document.
 *
 * CWRC represents every structural/entity tag in the TinyMCE body as
 * `<span _tag="realName" id="…">…</span>` (see `tagger.addStructureTag`),
 * with its own id/undo-manager/bookmark conventions. This is a different
 * write path from the namespaced-XML `nobleTitleSpanApply.ts`, which targets
 * a plain `Document` for programmatic use (e.g. backfill). The two apply
 * modules share the same parser and produce the same markup shape, but each
 * talks to its own kind of document.
 *
 * Strategy, mirroring `nobleTitleSpanApply.ts`:
 *  - A slot whose text already coincides with the right existing tag is
 *    reused untouched (its id is just added to the final wrap).
 *  - A slot with no existing tag gets a fresh one via `addStructureTag`,
 *    scoped to a precise sub-range of its original text node — no manual
 *    node splitting needed; `Range.surroundContents` (used internally by
 *    `addStructureTag`'s default action) splits the text node itself.
 *  - All of the title's component elements are then wrapped together in one
 *    `<nobleTitle>` via `addStructureTag`'s `around` action, which accepts
 *    an array of existing element ids (`tagger.ts`'s `Array.isArray(bookmark
 *    .tagId)` branch — present in the implementation but missing from its
 *    declared type, hence the casts below).
 *  - A trailing person name additionally wraps [nobleTitle, persName] in
 *    `<name type="personWrapper" cert="unknown">` — the documented
 *    awaiting-disambiguation state (`personWrapperValidation.ts`).
 */

import type { Action } from '../js/tagger';
import type Writer from '../js/Writer';
import {
  parseNobleTitleSpan,
  SLOT_TAG,
  type NobleTitleVocabulary,
  type ParsedSlot,
  type SlotRole,
  type SpanSegment,
} from './nobleTitleSpanParser';

export interface ApplyNobleTitleToEditorResult {
  applied: boolean;
  conflicts: string[];
}

type LiveSegment = SpanSegment & {
  /** The live node this segment maps to — a Text node, or a `_tag`-bearing Element. */
  node: Node;
  /** Offset in `node.textContent` where this segment's selected text begins (0 unless partially selected). */
  nodeTextStart: number;
};

/**
 * Describe the live selection as segments, the same shape the parser reads
 * for a preview, but carrying the live node + offset each segment maps to
 * so a slot can be turned back into a precise `Range` for committing.
 *
 * Handles the two shapes a selection actually takes:
 *  - Entirely inside one text node (the common case: plain running text) —
 *    `commonAncestorContainer` is that Text node itself.
 *  - Spanning several siblings (partially includes existing tags) —
 *    `commonAncestorContainer` is their shared parent Element; each
 *    boundary Text node is clipped to just the selected portion via the
 *    offsets, without physically splitting anything.
 */
export function liveSegmentsFromRange(range: Range): LiveSegment[] | null {
  const { startContainer, endContainer, startOffset, endOffset } = range;

  if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
    const text = (startContainer.textContent ?? '').slice(startOffset, endOffset);
    if (!text) return null;
    return [{ kind: 'text', text, node: startContainer, nodeTextStart: startOffset }];
  }

  const parent = range.commonAncestorContainer;
  if (parent.nodeType !== Node.ELEMENT_NODE) return null;

  const segments: LiveSegment[] = [];
  for (const child of Array.from(parent.childNodes)) {
    if (!range.intersectsNode(child)) continue;

    if (child.nodeType === Node.TEXT_NODE) {
      const full = child.textContent ?? '';
      const from = child === startContainer ? startOffset : 0;
      const to = child === endContainer ? endOffset : full.length;
      const text = full.slice(from, to);
      if (!text) continue;
      segments.push({ kind: 'text', text, node: child, nodeTextStart: from });
      continue;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tag = element.getAttribute('_tag');
      segments.push(
        tag
          ? {
              kind: 'element',
              localName: tag,
              text: element.textContent ?? '',
              node: element,
              nodeTextStart: 0,
            }
          : { kind: 'text', text: element.textContent ?? '', node: element, nodeTextStart: 0 },
      );
    }
  }
  return segments.length > 0 ? segments : null;
}

/** Build the `Range` for one slot's exact text within its live segment node. */
function rangeForSlot(doc: Document, segment: LiveSegment, slot: ParsedSlot): Range {
  const range = doc.createRange();
  const start = segment.nodeTextStart + slot.segmentTextOffset;
  range.setStart(segment.node, start);
  range.setEnd(segment.node, start + slot.text.length);
  return range;
}

const ADD: Action = 'add';
const AROUND: Action = 'around';

/**
 * `addStructureTag`'s declared bookmark type is `{ tagId: string | undefined
 * }`, but the implementation also accepts an array (tagger.ts:
 * `Array.isArray(bookmark.tagId)`) — exactly what wrapping several existing
 * elements together (`$node.wrapAll`) needs. Isolated here as the one place
 * that bridges the gap, instead of scattering casts through the call sites.
 */
function tagIdBookmark(tagId: string[]): { tagId: string } {
  return { tagId } as unknown as { tagId: string };
}

function tagNameFor(role: SlotRole): string | null {
  return role === 'dynasty' ? null : SLOT_TAG[role];
}

/**
 * Parse the given range as a noble title and commit it to the live document.
 * Returns `applied: false` (document untouched) when nothing recognisable
 * was found, mirroring `nobleTitleSpanApply.ts`'s contract.
 */
export function applyNobleTitleSpanToEditor(
  writer: Writer,
  range: Range,
  vocabulary: NobleTitleVocabulary,
): ApplyNobleTitleToEditorResult {
  const editor = writer.editor;
  if (!editor) return { applied: false, conflicts: ['no active editor'] };

  const liveSegments = liveSegmentsFromRange(range);
  if (!liveSegments) return { applied: false, conflicts: ['selection has an unsupported shape'] };

  const parsed = parseNobleTitleSpan(liveSegments, vocabulary);
  if (parsed.confidence === 'none') return { applied: false, conflicts: parsed.conflicts };

  const doc = liveSegments[0]!.node.ownerDocument ?? document;
  const idFor = new Map<SlotRole, string>();

  const tagSlot = (slot: ParsedSlot, attributes: Record<string, string> = {}): string | null => {
    const tagName = tagNameFor(slot.role);
    if (!tagName) return null;
    const segment = liveSegments[slot.segmentIndex]!;

    if (slot.existingTag) {
      // Already correctly (or plausibly) tagged — reuse it rather than
      // wrapping it again. Its id is picked up by the caller for the
      // enclosing <nobleTitle>/<name> wrap.
      return (segment.node as Element).id || null;
    }

    const subRange = rangeForSlot(doc, segment, slot);
    editor.selection.setRng(subRange);
    const bookmark = editor.selection.getBookmark(1);
    const tagged = writer.tagger.addStructureTag({ action: ADD, attributes, bookmark, tagName });
    return (tagged as Element | undefined)?.id ?? null;
  };

  // Several slots can share one original text node (e.g. an untagged
  // "鄱陽王範" splits into fief/rank/personName from a single segment).
  // `addStructureTag`'s ADD path uses `Range.surroundContents`, which
  // shrinks the original node down to whatever precedes the tagged range —
  // so tagging highest-offset-first (personName included, since it can share
  // the same segment) keeps every still-pending slot's offset valid against
  // that same (shrinking-from-the-end) node reference.
  const taggableSlotsDescending = parsed.slots
    .filter((slot) => slot.role !== 'dynasty')
    .sort((a, b) => a.segmentIndex - b.segmentIndex || b.segmentTextOffset - a.segmentTextOffset);

  for (const slot of taggableSlotsDescending) {
    const attributes: Record<string, string> = slot.role === 'posthumousName' ? { type: 'posthumous' } : {};
    const id = tagSlot(slot, attributes);
    if (id) idFor.set(slot.role, id);
  }

  const titleIds = (['fief', 'posthumousName', 'rank'] as const)
    .map((role) => idFor.get(role))
    .filter((id): id is string => Boolean(id));
  if (titleIds.length === 0) {
    return { applied: false, conflicts: [...parsed.conflicts, 'no taggable title component found'] };
  }

  const dynastySlot = parsed.slots.find((slot) => slot.role === 'dynasty');
  const nobleTitleAttrs: Record<string, string> = {};
  if (dynastySlot) nobleTitleAttrs.dynasty = dynastySlot.text;

  const nobleTitleEl = writer.tagger.addStructureTag({
    action: AROUND,
    attributes: nobleTitleAttrs,
    bookmark: tagIdBookmark(titleIds),
    tagName: 'nobleTitle',
  }) as Element | undefined;
  if (!nobleTitleEl?.id) {
    return { applied: false, conflicts: [...parsed.conflicts, 'failed to wrap the title components'] };
  }

  const personId = idFor.get('personName');
  if (personId) {
    writer.tagger.addStructureTag({
      action: AROUND,
      attributes: { type: 'personWrapper', cert: 'unknown' },
      bookmark: tagIdBookmark([nobleTitleEl.id, personId]),
      tagName: 'name',
    });
  }

  return { applied: true, conflicts: parsed.conflicts };
}
