export type { SearchScope as XPathScope } from '../shared/searchScope';

export interface XPathMatch {
  filePath: string;
  matchIndex: number;
  id?: string;
  label: string;
  xpath: string;
}

export interface XPathFileResult {
  filePath: string;
  filename: string;
  matches: Omit<XPathMatch, 'filePath'>[];
}

export interface PendingXPathJump {
  filePath: string;
  query: string;
  matchIndex: number;
  id?: string;
  xpath?: string;
}
