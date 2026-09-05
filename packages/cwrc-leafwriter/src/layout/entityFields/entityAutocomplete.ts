/**
 * Unit-scoped entity autocomplete for the translation pane.
 * Suggests while typing; Tab/Enter accepts (caller handles insert).
 */

import { chineseNameOf, familyAndGivenOf } from './entityDisplay';
import type { EntitySummary } from './entitySummary';
import type { MentionContext } from './mentionContext';
import { isCharacterOnlyTranslationTarget } from './mentionContext';
import { autoRomanize, autoRomanizeForKind } from '../../utilities/romanize';

export interface EntityAutocompleteCandidate {
  id: string;
  kind: string;
  /** Manifest row when this candidate maps to a specific source mention. */
  mentionIndex?: number;
  /** Primary label shown in the popup. */
  label: string;
  /** Extra line under the label (kind · key). */
  detail: string;
  /** Lowercased / trimmed strings used for prefix matching. */
  aliases: string[];
}

export interface CaretQuery {
  textNode: Text;
  /** Inclusive start offset of the query in the text node. */
  start: number;
  /** Exclusive end offset (= caret). */
  end: number;
  query: string;
}

export interface EntityAutocompleteSuggestion {
  candidate: EntityAutocompleteCandidate;
  matchedAlias: string;
  /** Higher is better. */
  score: number;
  textNode: Text;
  replaceStart: number;
  replaceEnd: number;
  query: string;
}

const MIN_LATIN_QUERY = 2;
const MIN_CJK_QUERY = 1;

const normalizeAlias = (raw: string): string => raw.replace(/\s+/g, ' ').trim();

const fold = (raw: string): string => normalizeAlias(raw).toLocaleLowerCase('en');

const isMostlyCjk = (text: string): boolean => /[\u3400-\u9FFF]/.test(text);

const addAlias = (into: Set<string>, value: string | null | undefined): void => {
  const normalized = normalizeAlias(value ?? '');
  if (normalized.length >= 1) into.add(normalized);
};

/** Build match aliases from a DB summary (+ optional source surface form). */
export const candidateFromEntity = (
  entity: EntitySummary,
  sourceSurface?: string | null,
): EntityAutocompleteCandidate => {
  const aliases = new Set<string>();
  addAlias(aliases, entity.romanizedName);
  addAlias(aliases, entity.primaryName);
  addAlias(aliases, entity.familyName);
  addAlias(aliases, sourceSurface);
  for (const name of entity.names) addAlias(aliases, name.text);

  // Family/given split only makes sense for a person-shaped name; splitting a
  // place/org/office/work title on its first space produces bogus aliases.
  if (entity.kind === 'person') {
    const { family, given } = familyAndGivenOf(entity);
    addAlias(aliases, family);
    addAlias(aliases, given);
    if (family && given) addAlias(aliases, `${family} ${given}`);
  }

  const chinese = chineseNameOf(entity);
  addAlias(aliases, chinese);

  const label = entity.romanizedName ?? entity.primaryName ?? chinese ?? sourceSurface ?? entity.id;

  return {
    id: entity.id,
    kind: entity.kind,
    label,
    detail: `${entity.kind} · ${entity.id}`,
    aliases: [...aliases],
  };
};

/** Build a mention-shaped candidate with preview label and surface-aware aliases. */
export const candidateFromMention = (
  mention: MentionContext,
  entity: EntitySummary,
  previewLabel: string,
  targetLang?: string | null,
): EntityAutocompleteCandidate => {
  const aliases = new Set<string>();
  addAlias(aliases, mention.surface);
  addAlias(aliases, previewLabel);
  addAlias(aliases, entity.romanizedName);
  addAlias(aliases, entity.primaryName);

  if (entity.kind === 'person') {
    const { family, given } = familyAndGivenOf(entity);
    addAlias(aliases, family);
    addAlias(aliases, given);
    if (family && given) addAlias(aliases, `${family} ${given}`);
    if (mention.role === 'partial-given') {
      addAlias(aliases, autoRomanize(mention.surface, targetLang, { concatenate: true }) ?? '');
    }
    if (mention.role === 'courtesy') {
      addAlias(aliases, autoRomanize(mention.surface, targetLang) ?? '');
    }
  } else {
    addAlias(aliases, autoRomanizeForKind(mention.surface, targetLang, mention.kind) ?? '');
  }

  const cjkTarget = isCharacterOnlyTranslationTarget(targetLang);
  const aliasList = [...aliases].filter(Boolean);
  if (cjkTarget) {
    aliasList.sort((a, b) => {
      const aCjk = isMostlyCjk(a) ? 1 : 0;
      const bCjk = isMostlyCjk(b) ? 1 : 0;
      return bCjk - aCjk;
    });
  }

  return {
    id: entity.id,
    kind: entity.kind,
    mentionIndex: mention.index,
    label: previewLabel,
    detail: `${mention.role} · ${mention.surface || entity.id}`,
    aliases: aliasList,
  };
};

export const candidatesFromEntities = (
  entities: { entity: EntitySummary; sourceSurface?: string | null }[],
): EntityAutocompleteCandidate[] =>
  entities.map(({ entity, sourceSurface }) => candidateFromEntity(entity, sourceSurface));

const minQueryLength = (query: string): number =>
  isMostlyCjk(query) ? MIN_CJK_QUERY : MIN_LATIN_QUERY;

/**
 * Score how well `query` matches an alias.
 * Exact > prefix of whole alias > prefix of a whitespace token in the alias.
 */
export const scoreAliasMatch = (query: string, alias: string): number => {
  const q = fold(query);
  const a = fold(alias);
  if (!q || !a || q.length < minQueryLength(query)) return 0;
  if (a === q) return 1000 + q.length;
  if (a.startsWith(q)) return 500 + q.length * 2 + Math.max(0, 40 - a.length);
  const tokens = a.split(' ');
  for (const token of tokens) {
    if (token === q) return 400 + q.length;
    if (token.startsWith(q)) return 200 + q.length * 2;
  }
  return 0;
};

export const rankEntityAutocomplete = (
  query: string,
  candidates: EntityAutocompleteCandidate[],
  limit = 8,
): { candidate: EntityAutocompleteCandidate; matchedAlias: string; score: number }[] => {
  if (!query || query.length < minQueryLength(query)) return [];

  const ranked: {
    candidate: EntityAutocompleteCandidate;
    matchedAlias: string;
    score: number;
  }[] = [];

  for (const candidate of candidates) {
    let bestScore = 0;
    let bestAlias = candidate.label;
    for (const alias of candidate.aliases) {
      const score = scoreAliasMatch(query, alias);
      if (score > bestScore) {
        bestScore = score;
        bestAlias = alias;
      }
    }
    if (bestScore > 0) ranked.push({ candidate, matchedAlias: bestAlias, score: bestScore });
  }

  ranked.sort((a, b) => b.score - a.score || a.candidate.label.localeCompare(b.candidate.label));
  return ranked.slice(0, limit);
};

/**
 * Read a name-like window before the caret (up to a few words / CJK run).
 * Does not decide the final query — {@link buildSuggestionsAtCaret} picks the
 * longest suffix that matches a candidate.
 */
export const getCaretNameWindow = (range: Range | null): CaretQuery | null => {
  if (!range || !range.collapsed) return null;
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType !== Node.TEXT_NODE) return null;
  const textNode = startContainer as Text;
  if (isInsideProtectedField(textNode)) return null;

  const text = textNode.nodeValue ?? '';
  const end = Math.max(0, Math.min(startOffset, text.length));
  if (end === 0) return null;

  let start = end;
  const before = text.slice(0, end);
  if (/[\u3400-\u9FFF]$/u.test(before)) {
    while (start > 0 && /[\u3400-\u9FFF]/u.test(text[start - 1]!)) start -= 1;
  } else {
    let spaces = 0;
    while (start > 0) {
      const ch = text[start - 1]!;
      if (/[\p{L}\p{M}'’\-.]/u.test(ch)) {
        start -= 1;
        continue;
      }
      if (ch === ' ' && spaces < 4 && start > 1 && /[\p{L}\p{M}]/u.test(text[start - 2]!)) {
        spaces += 1;
        start -= 1;
        continue;
      }
      break;
    }
    while (start < end && text[start] === ' ') start += 1;
  }

  const query = text.slice(start, end);
  if (!query) return null;
  if (!/[\p{L}\p{N}\u3400-\u9FFF]/u.test(query)) return null;

  return { textNode, start, end, query };
};

/** @deprecated Prefer {@link getCaretNameWindow}; kept as an alias for tests. */
export const getCaretQuery = getCaretNameWindow;

const isInsideProtectedField = (node: Node): boolean => {
  let el = node.parentElement;
  while (el) {
    const tag = el.tagName.toLowerCase();
    if (
      tag === 'ref' &&
      (el.getAttribute('type') === 'grognard-entity' || el.getAttribute('type') === 'grognard-date')
    ) {
      return true;
    }
    if (tag === 'bibl' && el.getAttribute('type') === 'zotero-ref') return true;
    el = el.parentElement;
  }
  return false;
};

/** Offsets (relative to window text) where a new word starts, longest query first. */
const querySuffixStarts = (windowText: string): number[] => {
  const starts = [0];
  for (let i = 1; i < windowText.length; i += 1) {
    if (windowText[i - 1] === ' ' && windowText[i] !== ' ') starts.push(i);
  }
  return starts;
};

/**
 * Suggest entities whose aliases are prefixed by the longest suitable caret suffix.
 * Example: window "See Cui Zu" → try "See Cui Zu", then "Cui Zu", then "Zu".
 */
export const buildSuggestionsAtCaret = (
  range: Range | null,
  candidates: EntityAutocompleteCandidate[],
): EntityAutocompleteSuggestion[] => {
  const window = getCaretNameWindow(range);
  if (!window) return [];

  const suffixStarts = querySuffixStarts(window.query);
  for (const localStart of suffixStarts) {
    const query = window.query.slice(localStart);
    const ranked = rankEntityAutocomplete(query, candidates);
    if (ranked.length === 0) continue;
    const replaceStart = window.start + localStart;
    return ranked.map((hit) => ({
      ...hit,
      textNode: window.textNode,
      replaceStart,
      replaceEnd: window.end,
      query,
    }));
  }
  return [];
};

/** Client rect for anchoring the popup just under the caret. */
export const caretAnchorPosition = (
  suggestion: Pick<EntityAutocompleteSuggestion, 'textNode' | 'replaceEnd'> | null,
  fallbackRange?: Range | null,
): { top: number; left: number } | null => {
  try {
    const probe = document.createRange();
    if (suggestion?.textNode?.parentNode) {
      const len = (suggestion.textNode.nodeValue ?? '').length;
      const offset = Math.min(Math.max(0, suggestion.replaceEnd), len);
      probe.setStart(suggestion.textNode, offset);
      probe.collapse(true);
    } else if (fallbackRange) {
      probe.setStart(fallbackRange.startContainer, fallbackRange.startOffset);
      probe.collapse(true);
    } else {
      return null;
    }

    const pickRect = (range: Range): DOMRect | null => {
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i += 1) {
        const rect = rects.item(i);
        if (rect && (rect.width > 0 || rect.height > 0)) return rect;
      }
      const box = range.getBoundingClientRect();
      if (box.width > 0 || box.height > 0 || box.top !== 0 || box.left !== 0) return box;
      return null;
    };

    let rect = pickRect(probe);
    if (rect) {
      if (rect.top === 0 && rect.left === 0 && rect.bottom === 0 && rect.right === 0) {
        rect = null;
      } else {
        return { top: rect.bottom + 4, left: rect.left };
      }
    }

    // Collapsed carets often report an empty rect — measure the previous character instead.
    if (!rect && probe.startContainer.nodeType === Node.TEXT_NODE && probe.startOffset > 0) {
      const prev = document.createRange();
      prev.setStart(probe.startContainer, probe.startOffset - 1);
      prev.setEnd(probe.startContainer, probe.startOffset);
      const prevRect = pickRect(prev);
      if (prevRect) {
        return { top: prevRect.bottom + 4, left: prevRect.right };
      }
    }

    // Next character (caret at start of a text node).
    if (
      !rect &&
      probe.startContainer.nodeType === Node.TEXT_NODE &&
      probe.startOffset < ((probe.startContainer as Text).nodeValue?.length ?? 0)
    ) {
      const next = document.createRange();
      next.setStart(probe.startContainer, probe.startOffset);
      next.setEnd(probe.startContainer, probe.startOffset + 1);
      const nextRect = pickRect(next);
      if (nextRect) {
        return { top: nextRect.bottom + 4, left: nextRect.left };
      }
    }

    // Parent block as a coarse fallback — better than mutating the live document.
    const host =
      probe.startContainer.nodeType === Node.ELEMENT_NODE
        ? (probe.startContainer as Element)
        : probe.startContainer.parentElement;
    const hostRect = host?.getBoundingClientRect();
    if (hostRect && (hostRect.width > 0 || hostRect.height > 0)) {
      return { top: hostRect.top + Math.min(24, hostRect.height) + 4, left: hostRect.left + 8 };
    }

    return null;
  } catch {
    return null;
  }
};
