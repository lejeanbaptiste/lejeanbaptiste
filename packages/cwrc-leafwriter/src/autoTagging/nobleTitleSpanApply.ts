/**
 * Apply a parsed noble-title span to the document, re-parenting any elements
 * the span already contained instead of regenerating them.
 *
 * This deliberately does not reuse `replaceInnerStructure` (apply.ts): that
 * path clears the target's children before inserting generated markup, which
 * would discard a pre-existing `<placeName ref="…">` and its attributes — the
 * exact thing a manually-tagged span is most likely to carry.
 */

import {
  parseNobleTitleSpan,
  SLOT_TAG,
  type NobleTitleVocabulary,
  type ParsedSlot,
  type SpanSegment,
} from './nobleTitleSpanParser';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

export interface ApplyNobleTitleSpanResult {
  applied: boolean;
  /** The `<nobleTitle>`, or the `<name type="personWrapper">` when one was needed. */
  element?: Element;
  /** Parse warnings plus any blocking reason. */
  conflicts: string[];
}

/** Describe a run of sibling nodes for the parser. */
export function segmentsFromNodes(nodes: readonly Node[]): SpanSegment[] {
  const segments: SpanSegment[] = [];
  for (const node of nodes) {
    if (node.nodeType === ELEMENT_NODE) {
      const element = node as Element;
      segments.push({
        kind: 'element',
        localName: element.localName || element.nodeName,
        text: element.textContent ?? '',
      });
    } else {
      segments.push({ kind: 'text', text: node.textContent ?? '' });
    }
  }
  return segments;
}

const teiNsOf = (doc: Document): string =>
  doc.documentElement?.namespaceURI ?? 'http://www.tei-c.org/ns/1.0';

/**
 * Parse a contiguous run of sibling nodes as a noble title and replace it
 * with the decomposed markup.
 *
 * A trailing personal name means the span identifies a person, not just a
 * title, so the result is wrapped in `<name type="personWrapper">` carrying
 * `cert="unknown"` — the documented pending state for a wrapper whose person
 * is not yet resolved. Any dynasty component becomes `@dynasty` on the
 * `<nobleTitle>`; its text survives as a `<nationality>` inside the wrapper,
 * or as plain text beside the title when there is no wrapper, since
 * `<nobleTitle>` may only contain placeName/roleName/persName.
 */
export function applyNobleTitleSpan(
  doc: Document,
  nodes: readonly Node[],
  vocabulary: NobleTitleVocabulary,
): ApplyNobleTitleSpanResult {
  if (nodes.length === 0) return { applied: false, conflicts: ['empty selection'] };
  const parent = nodes[0]!.parentNode;
  if (!parent) return { applied: false, conflicts: ['selection is not attached to a document'] };
  for (const node of nodes) {
    if (node.parentNode !== parent) {
      return { applied: false, conflicts: ['selection spans more than one parent element'] };
    }
  }

  const parsed = parseNobleTitleSpan(segmentsFromNodes(nodes), vocabulary);
  if (parsed.confidence === 'none') return { applied: false, conflicts: parsed.conflicts };

  const conflicts = [...parsed.conflicts];
  const ns = teiNsOf(doc);

  // Refuse rather than overwrite a deliberate, different @type on a reused
  // persName (e.g. a temple name sitting where the 謚號 is expected).
  for (const slot of parsed.slots) {
    if (slot.role !== 'posthumousName' || !slot.existingTag) continue;
    const source = nodes[slot.segmentIndex];
    if (!source || source.nodeType !== ELEMENT_NODE) continue;
    const existingType = (source as Element).getAttribute('type');
    if (existingType && existingType !== 'posthumous') {
      conflicts.push(
        `existing <persName type="${existingType}"> on "${slot.text}" sits where the posthumous name is expected; retag it before applying`,
      );
      return { applied: false, conflicts };
    }
  }

  /** Reuse the original element when the slot coincides with one, else mint a new one. */
  const materialize = (slot: ParsedSlot, wanted: string): Element => {
    const source = nodes[slot.segmentIndex];
    if (slot.existingTag === wanted && source?.nodeType === ELEMENT_NODE) {
      return source as Element; // appending re-parents it, attributes intact
    }
    const created = doc.createElementNS(ns, wanted);
    created.textContent = slot.text;
    return created;
  };

  const nobleTitle = doc.createElementNS(ns, 'nobleTitle');
  const dynastySlot = parsed.slots.find((slot) => slot.role === 'dynasty');
  if (dynastySlot) nobleTitle.setAttribute('dynasty', dynastySlot.text);

  for (const slot of parsed.slots) {
    if (slot.role === 'dynasty' || slot.role === 'personName') continue;
    const wanted = SLOT_TAG[slot.role];
    const element = materialize(slot, wanted);
    if (slot.role === 'posthumousName') element.setAttribute('type', 'posthumous');
    nobleTitle.appendChild(element);
  }

  const personSlot = parsed.slots.find((slot) => slot.role === 'personName');
  let top: Element = nobleTitle;

  if (personSlot) {
    const wrapper = doc.createElementNS(ns, 'name');
    wrapper.setAttribute('type', 'personWrapper');
    // No resolved person yet; this is the documented pending state.
    wrapper.setAttribute('cert', 'unknown');
    if (dynastySlot) {
      const nationality = doc.createElementNS(ns, 'nationality');
      nationality.textContent = dynastySlot.text;
      wrapper.appendChild(nationality);
    }
    wrapper.appendChild(nobleTitle);
    wrapper.appendChild(materialize(personSlot, 'persName'));
    top = wrapper;
  }

  // Capture the insertion point before re-parenting detaches anything.
  const anchor = nodes[nodes.length - 1]!.nextSibling;
  for (const node of nodes) {
    if (node.parentNode === parent) parent.removeChild(node);
  }
  // Without a wrapper there is nowhere legal inside <nobleTitle> for the
  // dynasty text, so keep it as a sibling rather than dropping content.
  if (dynastySlot && !personSlot) {
    parent.insertBefore(doc.createTextNode(dynastySlot.text), anchor);
  }
  parent.insertBefore(top, anchor);

  return { applied: true, element: top, conflicts };
}
