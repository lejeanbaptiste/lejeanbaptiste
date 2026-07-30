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
 *  3. Parse childless `<nobleTitle>` text into structured components.
 *  4. Wrap adjacent tagged person components in `<name type="personWrapper">`
 *     (reuses the existing compound-wrapper matcher/apply path).
 *  5. Give every keyless personWrapper a `@key`: copy it down from an
 *     already-keyed inner `<persName>`, or attempt a unique entities.xml
 *     match; anything still unresolved is left for the normal disambiguation
 *     panel to pick up on its next scan.
 *
 * Every element the pass actually mutates or creates is collected so the
 * validation panel can be scoped to just that set afterward, instead of
 * re-checking the whole document.
 */

import { resolveXPath } from './anchor';
import { applySuggestions, type ApplyOptions } from './apply';
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
import { compoundWrapperSuggestions } from './seed';
import type { WhitespacePolicy } from './types';

/** The identity-bearing child of a person wrapper (not a posthumous/temple name). */
function wrapperPersonName(wrapper: Element): Element | null {
  return (
    Array.from(wrapper.getElementsByTagName('persName')).find(
      (element) => !element.getAttribute('type'),
    ) ?? null
  );
}

function isPersonWrapper(element: Element): boolean {
  return (element.localName || element.nodeName) === 'name' &&
    element.getAttribute('type') === 'personWrapper';
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
    if (!next || (next.localName || next.nodeName) !== 'roleName') continue;
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

/** Parse every childless `<nobleTitle>` in scope into structured components. */
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
    if (dynastySlot) el.setAttribute('dynasty', dynastySlot.text);
    while (el.firstChild) el.removeChild(el.firstChild);
    for (const slot of result.slots) {
      if (slot.role === 'dynasty') continue;
      const child = doc.createElementNS(ns, SLOT_TAG[slot.role]);
      if (slot.role === 'posthumousName') child.setAttribute('type', 'posthumous');
      child.textContent = slot.text;
      el.appendChild(child);
    }
    touched.add(el);
    parsed++;
  }
  return parsed;
}

/**
 * Create person wrappers for adjacent already-tagged components in scope,
 * reusing the existing compound-wrapper matcher and apply path directly
 * (rather than surfacing the matches as suggestions for review).
 */
export async function createPersonWrappersInScope(
  doc: Document,
  scopeRoot: Element,
  wrapperCandidates: readonly AuthorityCandidate[],
  policy: WhitespacePolicy,
  applyOptions: ApplyOptions,
  touched: Set<Element>,
): Promise<number> {
  const matches = compoundWrapperSuggestions(doc, [...wrapperCandidates], policy);
  const suggestions = matches
    .map((match) => match.suggestion)
    .filter((suggestion) => {
      const node = resolveXPath(doc, suggestion.anchor.xpath);
      return !!node && scopeRoot.contains(node);
    });
  if (suggestions.length === 0) return 0;

  const { results } = await applySuggestions(doc, suggestions, applyOptions);
  let created = 0;
  for (const result of results) {
    if (result.outcome === 'applied' && result.element) {
      touched.add(result.element);
      created++;
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

export async function runGroupAndClean(
  doc: Document,
  entitiesDoc: Document,
  scopeRoot: Element,
  officeCandidates: readonly AuthorityCandidate[],
  wrapperCandidates: readonly AuthorityCandidate[],
  vocabulary: NobleTitleVocabulary,
  policy: WhitespacePolicy,
  applyOptions: ApplyOptions,
): Promise<GroupAndCleanResult> {
  const touched = new Set<Element>();
  const officeIndex = buildOfficeIndex(officeCandidates);

  const mergedRoleNames = mergeAdjacentRoleNames(scopeRoot, officeIndex, touched);
  const rolledPlaceNames = rollPlaceIntoRole(scopeRoot, officeIndex, touched);
  const parsedNobleTitles = parseChildlessNobleTitles(scopeRoot, vocabulary, touched);
  const createdWrappers = await createPersonWrappersInScope(
    doc,
    scopeRoot,
    wrapperCandidates,
    policy,
    applyOptions,
    touched,
  );
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
