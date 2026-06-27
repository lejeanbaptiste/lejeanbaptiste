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
}

export interface FindFileResult {
  filePath: string;
  filename: string;
  matches: TextHit[];
}

export interface PendingFindJump {
  end: number;
  filePath: string;
  line: number;
  column: number;
  matchIndexInFile: number;
  query: string;
  start: number;
  useRegex: boolean;
}
