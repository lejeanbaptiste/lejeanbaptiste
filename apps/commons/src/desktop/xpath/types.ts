export type { SearchScope as XPathScope } from '../shared/searchScope';

export interface XPathMatch {
  filePath: string;
  label: string;
  xpath: string;
  /** Index within the file's result list (UI navigation only). */
  resultIndex: number;
}

export interface XPathFileResult {
  filePath: string;
  filename: string;
  matches: Omit<XPathMatch, 'filePath'>[];
}

export interface PendingXPathJump {
  filePath: string;
  query: string;
  resultIndex: number;
  xpath: string;
}
