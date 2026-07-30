/**
 * Norbert "Group and clean" — a post-validation cleanup pass over already
 * committed/reviewed markup. Unlike the tag-bomb / wrapper-concatenation
 * passes, this mutates the document directly rather than producing
 * `Suggestion`s for review, since it only ever acts on tags the user has
 * already accepted.
 *
 * Five steps, run in order over a scope (a selection root, or the whole
 * document):
 *  1. Merge adjacent `<roleName>`s that form one compound office
 *     (`office.followsOffice`).
 *  2. Nest a preceding `<placeName>` inside a `<roleName>` that takes one
 *     (`office.followsPlace`).
 *  3. Parse childless `<nobleTitle>` text into structured components,
 *     splitting out a trailing identity name into a sibling `<persName>`
 *     under a new wrapper (a title's own text never carries the person's
 *     identity — see `applyNobleTitleSpan` in nobleTitleSpanApply.ts, which
 *     this mirrors).
 *  4. Wrap every maximal run of adjacent tagged person components
 *     (`persName`/`roleName`/`placeName`/`nobleTitle`/`nationality`) that
 *     includes a `persName` plus at least one other component in
 *     `<name type="personWrapper">`. This is a purely structural rule — it
 *     does not depend on the person being a known authority record, since
 *     most mentions in a corpus won't be.
 *  5. Give every keyless personWrapper a `@key`: copy it down from an
 *     already-keyed inner `<persName>`, or attempt a unique entities.xml
 *     match; anything still unresolved is left for the normal disambiguation
 *     panel to pick up on its next scan.
 *
 * Every element the pass actually mutates or creates is collected so the
 * validation panel can be scoped to just that set afterward, instead of
 * re-checking the whole document.
 */

import type { AuthorityCandidate } from './authority';
import { candidatesFromEntityFile } from './disambiguationCandidates';
import {
  parseNobleTitleSpan,
  SLOT_TAG,
  type NobleTitleVocabulary,
} from './nobleTitleSpanParser';
import {
  validatePersonWrapper,
  type PersonWrapperValidation,
} from './personWrapperValidation';

/** The identity-bearing child of a person wrapper (not a posthumous/temple name). */
function wrapperPersonName(wrapper: Element): Element | null {
  return (
    Array.from(wrapper.getElementsByTagName('persName')).find(
      (element) => !element.getAttribute('type'),
    ) ?? null
  );
}

function localNameOf(node: Node): string {
  return (node as Element).localName || node.nodeName;
}

function isPersonWrapper(element: Element): boolean {
  return localNameOf(element) === 'name' && element.getAttribute('type') === 'personWrapper';
}

/** True when `second` immediately follows `first`, ignoring whitespace-only text between them. */
function elementsAdjacent(first: Element, second: Element): boolean {
  let cursor: ChildNode | null = first.nextSibling;
  while (cursor && cursor.nodeType === 3 && !(cursor.textContent ?? '').trim()) {
    cursor = cursor.nextSibling;
  }
  return cursor === second;
}

/** Remove whitespace-only nodes sitting between two now-merging siblings. */
function stripWhitespaceBetween(first: Element, second: Element): void {
  let cursor = first.nextSibling;
  while (cursor && cursor !== second) {
    const next = cursor.nextSibling;
    cursor.parentNode?.removeChild(cursor);
    cursor = next;
  }
}

/** Index office authority candidates by every surface string they match. */
export function buildOfficeIndex(
  candidates: readonly AuthorityCandidate[],
): Map<string, AuthorityCandidate[]> {
  const index = new Map<string, AuthorityCandidate[]>();
  for (const candidate of candidates) {
    if (candidate.kind !== 'office') continue;
    for (const surface of candidate.searchStrings) {
      const list = index.get(surface);
      if (list) list.push(candidate);
      else index.set(surface, [candidate]);
    }
  }
  return index;
}

/**
 * Merge sibling `<roleName>` pairs into one when the office pack says the
 * second office's name follows another office name (`metadata.followsOffice`)
 * — e.g. 尚書 + 吏部 → 尚書吏部. Chains (three or more) collapse in one pass.
 */
export function mergeAdjacentRoleNames(
  scopeRoot: Element,
  officeIndex: Map<string, AuthorityCandidate[]>,
  touched: Set<Element>,
): number {
  let merged = 0;
  let roleNames = Array.from(scopeRoot.getElementsByTagName('roleName'));
  let i = 0;
  while (i < roleNames.length - 1) {
    const first = roleNames[i]!;
    const second = roleNames[i + 1]!;
    if (first.parentNode !== second.parentNode || !elementsAdjacent(first, second)) {
      i++;
      continue;
    }
    const secondText = second.textContent ?? '';
    const candidates = officeIndex.get(secondText) ?? [];
    if (!candidates.some((c) => c.metadata?.followsOffice)) {
      i++;
      continue;
    }
    stripWhitespaceBetween(first, second);
    first.textContent = (first.textContent ?? '') + secondText;
    second.parentNode?.removeChild(second);
    touched.add(first);
    merged++;
    // Re-scan: the merged element may now be adjacent to a further roleName.
    roleNames = Array.from(scopeRoot.getElementsByTagName('roleName'));
  }
  return merged;
}

/**
 * Nest a `<placeName>` inside the `<roleName>` that immediately follows it,
 * when the office pack says that office takes a preceding place name
 * (`metadata.followsPlace`) — e.g. 荊州 + 刺史 → `<roleName><placeName>荊州</placeName>刺史</roleName>`.
 */
export function rollPlaceIntoRole(
  scopeRoot: Element,
  officeIndex: Map<string, AuthorityCandidate[]>,
  touched: Set<Element>,
): number {
  let rolled = 0;
  const placeNames = Array.from(scopeRoot.getElementsByTagName('placeName'));
  for (const place of placeNames) {
    const next = place.nextElementSibling;
    if (!next || localNameOf(next) !== 'roleName') continue;
    if (place.parentNode !== next.parentNode || !elementsAdjacent(place, next)) continue;
    const roleText = next.textContent ?? '';
    const candidates = officeIndex.get(roleText) ?? [];
    if (!candidates.some((c) => c.metadata?.followsPlace)) continue;
    stripWhitespaceBetween(place, next);
    place.parentNode?.removeChild(place);
    next.insertBefore(place, next.firstChild);
    touched.add(next);
    rolled++;
  }
  return rolled;
}

/**
 * Parse every childless `<nobleTitle>` in scope into structured components.
 * A trailing identity name (the parser's `personName` slot) never becomes a
 * `<nobleTitle>` child — it's split out into a sibling `<persName>` inside a
 * new `<name type="personWrapper">` that replaces the title in place.
 */
export function parseChildlessNobleTitles(
  scopeRoot: Element,
  vocabulary: NobleTitleVocabulary,
  touched: Set<Element>,
): number {
  let parsed = 0;
  const doc = scopeRoot.ownerDocument;
  if (!doc) return 0;
  const ns = doc.documentElement?.namespaceURI ?? null;
  for (const el of Array.from(scopeRoot.getElementsByTagName('nobleTitle'))) {
    if (el.children.length > 0) continue;
    const text = el.textContent ?? '';
    if (!text.trim()) continue;
    const result = parseNobleTitleSpan([{ kind: 'text', text }], vocabulary);
    if (result.confidence === 'none') continue;

    const dynastySlot = result.slots.find((slot) => slot.role === 'dynasty');
    const personSlot = result.slots.find((slot) => slot.role === 'personName');
    if (dynastySlot) el.setAttribute('dynasty', dynastySlot.text);
    while (el.firstChild) el.removeChild(el.firstChild);
    for (const slot of result.slots) {
      if (slot.role === 'dynasty' || slot.role === 'personName') continue;
      const child = doc.createElementNS(ns, SLOT_TAG[slot.role]);
      if (slot.role === 'posthumousName') child.setAttribute('type', 'posthumous');
      child.textContent = slot.text;
      el.appendChild(child);
    }

    if (personSlot) {
      const wrapper = doc.createElementNS(ns, 'name');
      wrapper.setAttribute('type', 'personWrapper');
      wrapper.setAttribute('cert', 'unknown');
      el.parentNode!.insertBefore(wrapper, el);
      wrapper.appendChild(el);
      const persNameEl = doc.createElementNS(ns, 'persName');
      persNameEl.textContent = personSlot.text;
      wrapper.appendChild(persNameEl);
      touched.add(wrapper);
    } else {
      touched.add(el);
    }
    parsed++;
  }
  return parsed;
}

const WRAPPER_COMPONENT_TAGS = new Set([
  'nationality',
  'nobleTitle',
  'roleName',
  'placeName',
  'persName',
]);

function isWrapperComponent(node: Node): node is Element {
  return node.nodeType === 1 && WRAPPER_COMPONENT_TAGS.has(localNameOf(node));
}

function isWhitespaceText(node: Node): boolean {
  return node.nodeType === 3 && !(node.textContent ?? '').trim();
}

function isInsidePersonWrapper(element: Element): boolean {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (isPersonWrapper(ancestor)) return true;
  }
  return false;
}

/**
 * Wrap each `persName` together with whatever role/place/title components
 * immediately precede it, in `<name type="personWrapper">`. Norbert's
 * convention is that the person's name is the *last* element of the group —
 * a title or office always leads, never trails — so this only ever scans
 * backward from a `persName`, collecting adjacent components (skipping
 * whitespace-only gaps) until it hits the first non-component node. Nothing
 * after the `persName` is ever pulled in. A lone `persName` with no such
 * preceding component is left untouched, since wrapping it alone would
 * group nothing. This is purely structural: it does not require the person
 * to be a known authority record, since most mentions in a corpus won't be
 * — key assignment (which does use authority data) happens separately
 * afterward.
 */
export function createPersonWrappersInScope(scopeRoot: Element, touched: Set<Element>): number {
  const doc = scopeRoot.ownerDocument;
  if (!doc) return 0;
  const ns = doc.documentElement?.namespaceURI ?? null;

  let created = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const persName of Array.from(scopeRoot.getElementsByTagName('persName'))) {
      if (isInsidePersonWrapper(persName)) continue;
      const parent = persName.parentElement;
      // A persName nested inside e.g. a nobleTitle (a posthumous/temple
      // name) isn't a grouping candidate at that level.
      if (!parent || isWrapperComponent(parent)) continue;

      let first: ChildNode = persName;
      let precedingComponents = 0;
      let cursor: ChildNode | null = persName.previousSibling;
      while (cursor) {
        if (isWrapperComponent(cursor) && localNameOf(cursor) !== 'persName') {
          first = cursor;
          precedingComponents++;
          cursor = cursor.previousSibling;
          continue;
        }
        if (isWhitespaceText(cursor)) {
          cursor = cursor.previousSibling;
          continue;
        }
        break;
      }
      if (precedingComponents === 0) continue;

      const wrapper = doc.createElementNS(ns, 'name');
      wrapper.setAttribute('type', 'personWrapper');
      wrapper.setAttribute('cert', 'unknown');
      parent.insertBefore(wrapper, first);
      let node: ChildNode | null = first;
      while (node) {
        const next: ChildNode | null = node.nextSibling;
        wrapper.appendChild(node);
        if (node === persName) break;
        node = next;
      }
      touched.add(wrapper);
      created++;
      changed = true;
      break; // DOM changed under getElementsByTagName's live list — restart the scan
    }
  }
  return created;
}

export interface AssignPersonWrapperKeysResult {
  copied: number;
  autoResolved: number;
}

/**
 * Give every keyless `<name type="personWrapper">` in scope a `@key`: copy
 * it down from an already-keyed inner `<persName>`, or — when the persName
 * itself has no key — attempt a unique match against local entities.xml and
 * assign both. A wrapper that's still ambiguous or unmatched is left alone;
 * its inner persName stays keyless/`cert="unknown"`, which is exactly what
 * the normal disambiguation panel already scans for, so it surfaces there
 * without any extra queueing step here.
 */
export function assignPersonWrapperKeys(
  scopeRoot: Element,
  entitiesDoc: Document,
  touched: Set<Element>,
): AssignPersonWrapperKeysResult {
  let copied = 0;
  let autoResolved = 0;
  const wrappers = Array.from(scopeRoot.getElementsByTagName('name')).filter(
    (el) => isPersonWrapper(el) && !el.getAttribute('key')?.trim(),
  );
  for (const wrapper of wrappers) {
    const persName = wrapperPersonName(wrapper);
    if (!persName) continue;
    let key = persName.getAttribute('key')?.trim();
    if (!key) {
      const surface = persName.textContent?.trim() ?? '';
      if (surface) {
        const candidates = candidatesFromEntityFile(entitiesDoc, 'persName', surface);
        const unique = candidates.length === 1 ? candidates[0] : undefined;
        if (unique?.localEntityId) {
          key = unique.localEntityId;
          persName.setAttribute('key', key);
          persName.removeAttribute('cert');
          autoResolved++;
        }
      }
    }
    if (key) {
      wrapper.setAttribute('key', key);
      wrapper.removeAttribute('cert');
      touched.add(wrapper);
      copied++;
    }
  }
  return { copied, autoResolved };
}

/** Validate only the person wrappers this pass actually touched (or that contain a touched element). */
export function scopedPersonWrapperValidation(touched: Set<Element>): PersonWrapperValidation {
  const wrappers = new Set<Element>();
  for (const el of touched) {
    if (isPersonWrapper(el)) {
      wrappers.add(el);
      continue;
    }
    for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (isPersonWrapper(ancestor)) {
        wrappers.add(ancestor);
        break;
      }
    }
  }
  const errors: string[] = [];
  let pending = 0;
  for (const wrapper of wrappers) {
    const result = validatePersonWrapper(wrapper);
    errors.push(...result.errors.map((error) => `${error} (${wrapper.textContent?.trim() ?? ''})`));
    pending += result.pending ?? 0;
  }
  return pending > 0
    ? { valid: errors.length === 0, errors, pending }
    : { valid: errors.length === 0, errors };
}

export interface GroupAndCleanResult {
  mergedRoleNames: number;
  rolledPlaceNames: number;
  parsedNobleTitles: number;
  createdWrappers: number;
  assignedKeys: number;
  autoResolvedKeys: number;
  touched: Set<Element>;
  validation: PersonWrapperValidation;
}

export function runGroupAndClean(
  entitiesDoc: Document,
  scopeRoot: Element,
  officeCandidates: readonly AuthorityCandidate[],
  vocabulary: NobleTitleVocabulary,
): GroupAndCleanResult {
  const touched = new Set<Element>();
  const officeIndex = buildOfficeIndex(officeCandidates);

  const mergedRoleNames = mergeAdjacentRoleNames(scopeRoot, officeIndex, touched);
  const rolledPlaceNames = rollPlaceIntoRole(scopeRoot, officeIndex, touched);
  const parsedNobleTitles = parseChildlessNobleTitles(scopeRoot, vocabulary, touched);
  const createdWrappers = createPersonWrappersInScope(scopeRoot, touched);
  const { copied, autoResolved } = assignPersonWrapperKeys(scopeRoot, entitiesDoc, touched);

  return {
    mergedRoleNames,
    rolledPlaceNames,
    parsedNobleTitles,
    createdWrappers,
    assignedKeys: copied,
    autoResolvedKeys: autoResolved,
    touched,
    validation: scopedPersonWrapperValidation(touched),
  };
}
