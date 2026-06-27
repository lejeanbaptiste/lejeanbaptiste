export interface VisibleSnippet {
  match: string;
  prefix: string;
  suffix: string;
}

export interface TextHit {
  matchIndex: number;
  start: number;
  end: number;
  line: number;
  column: number;
  snippet: VisibleSnippet;
  /** True when hit lies in a single raw XML text run (phase 2a replace). */
  replaceable?: boolean;
}

export interface FindFileResult {
  filePath: string;
  filename: string;
  matches: TextHit[];
}

export type FindHighlightMode = 'active-only' | 'full' | 'scroll-only';

export interface PendingFindJump {
  contentForJump?: string;
  end: number;
  filePath: string;
  highlightMode?: FindHighlightMode;
  line: number;
  column: number;
  matchIndexInFile: number;
  query: string;
  start: number;
  useRegex: boolean;
}
