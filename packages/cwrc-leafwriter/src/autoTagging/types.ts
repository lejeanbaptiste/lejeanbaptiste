export type SuggestionSource =
  | 'dictionary'
  | 'authority'
  | 'dates'
  | 'ai'
  | 'ner'
  | 'disambiguation';

export type SuggestionAction =
  | 'add'
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
}

export interface Suggestion {
  id: string;
  source: SuggestionSource;
  /** e.g. dictionary table name, model id, ruleset version */
  sourceDetail?: string;
  action: SuggestionAction;
  tag: string;
  attributes?: Record<string, string>;
  anchor: Anchor;
  confidence?: number;
  rationale?: string;
  status: SuggestionStatus;
  /** East Asian dates: parse + resolution metadata from sanmiao. */
  dateResolution?: DateResolution;
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
  /** Prior accepted date in this batch used as sequential context (Phase 2b). */
  attachToDateIndex?: number;
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
