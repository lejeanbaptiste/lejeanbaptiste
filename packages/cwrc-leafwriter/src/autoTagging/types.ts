export type SuggestionSource =
  'dictionary' | 'authority' | 'dates' | 'ai' | 'ner' | 'disambiguation';

export type SuggestionAction =
  | 'add'
  | 'add-compound'
  | 'remove'
  | 'retag'
  | 'redraw-boundary'
  | 'assign-entity'
  | 'resolve-date';

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'unresolvable';

/**
 * Whitespace handling when building search text from text nodes.
 * - 'ignore': whitespace is stripped entirely (CJK documents, where in-node
 *   whitespace is layout noise and may fall mid-name).
 * - 'collapse': whitespace runs collapse to a single space (whitespace-delimited languages).
 */
export type WhitespacePolicy = 'ignore' | 'collapse';

export interface Anchor {
  documentId: string;
  /** Structural path to the text node, e.g. /TEI/text/body/div[1]/p[3]/text()[1] */
  xpath: string;
  /** Start offset in the raw (NFC-normalized) text node data. */
  offset: number;
  /** The surface string as it appears in the search text (whitespace policy applied). */
  surface: string;
  /** 1-based index of this surface string among its occurrences in the whole document's search text. */
  occurrence: number;
  /** Search-text context immediately before/after the match. */
  contextBefore: string;
  contextAfter: string;
  /** Hash of the text node's search text, to detect staleness. */
  nodeHash: string;
  /** End boundary for a compound suggestion spanning tagged sibling elements. */
  endXpath?: string;
  endOffset?: number;
}

export interface Suggestion {
  id: string;
  source: SuggestionSource;
  /** e.g. dictionary table name, model id, ruleset version */
  sourceDetail?: string;
  action: SuggestionAction;
  tag: string;
  attributes?: Record<string, string>;
  /** Optional nested TEI content, used by compound plugin suggestions. */
  innerXml?: string;
  anchor: Anchor;
  confidence?: number;
  rationale?: string;
  status: SuggestionStatus;
  /** East Asian dates: parse + resolution metadata from sanmiao. */
  dateResolution?: DateResolution;
  /** AI validation metadata — populated when AI validation is enabled. */
  aiValidation?: AiValidationResult;
  /**
   * For a synthetic wrapper-candidate `add-compound` suggestion (see
   * `groupWrapperCandidateSuggestions`): the individual component
   * suggestions it consumes. These have no tagged elements to wrap yet —
   * `apply.ts`'s `applyWithWrapperCandidates` applies them first, in the
   * same commit, before the compound wrap itself.
   */
  compoundMembers?: Suggestion[];
}

/** AI validation result for a suggestion. */
export interface AiValidationResult {
  /** Overall validation score (0-1), where 1 = definitely correct, 0 = definitely wrong. */
  confidence: number;
  /** Warning message if AI flags this suggestion as problematic. */
  warning?: string;
  /** True if AI recommends accepting this suggestion. */
  recommended: boolean;
  /** Rationale from the AI for its validation decision. */
  rationale?: string;
  /** Timestamp of validation. */
  validatedAt?: string;
}

/** Default AI validation result when validation hasn't run. */
export function createDefaultAiValidation(recommended = false): AiValidationResult {
  return {
    confidence: 0.5,
    recommended,
  };
}

export interface DateCandidate {
  displayLine: string;
  attrs?: Record<string, string>;
  era_id?: number;
  dyn_id?: number;
  error_str?: string;
}

export interface DateResolution {
  status: 'tagged' | 'unique' | 'ambiguous' | 'unresolved' | 'range';
  candidates?: DateCandidate[];
  /** Sanmiao parse children (inner XML only), applied inside `<date>`. */
  parseXml?: string;
  /** User's pick when status is ambiguous or unresolved with multiple candidates. */
  selectedCandidateIndex?: number;
  /**
   * True once the curator picks/locks an interpretation. Recalculation must not
   * replace this row when a later date is disambiguated.
   */
  userLocked?: boolean;
  /** Prior accepted date in this batch used as sequential context (Phase 2b). */
  attachToDateIndex?: number;
  /** Full `<date>` text for curator display/focus; anchor.surface stays on the first text node for apply. */
  displaySurface?: string;
  /** Inline curator edits, kept separate from Sanmiao's original candidate attrs. */
  editorAttributes?: Record<string, string>;
}

/** A resolved anchor: the concrete text node and raw offsets to act on. */
export interface ResolvedAnchor {
  node: Text;
  /** Raw offsets into node.data delimiting the surface match. */
  start: number;
  end: number;
  /** Which resolution tier succeeded (1 = fast path … 3 = whole-document search). */
  tier: 1 | 2 | 3;
}
