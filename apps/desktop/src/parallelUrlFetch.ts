import { fetchCtextWikiParallel } from './ctextWikiParallel';
import { fetchWikisourceParallel } from './wikisourceParallel';
import {
  fetchGenericUrlParallel,
  isCtextWikiUrl,
  isWikisourceUrl,
  unsupportedCtextUrlMessage,
  type ParallelUrlFetchResult,
  type UrlFetchFn,
} from '../../commons/src/desktop/parallelUrlFetch';

export interface FetchParallelUrlOptions {
  url: string;
  section?: string;
  contains?: string;
  fetchAll?: boolean;
}

export type ParallelUrlFetchResponse = ParallelUrlFetchResult & {
  section?: string;
  rowId?: string;
  rowIds?: string[];
  sections?: { id: string; slug: string; title: string; rowCount: number }[];
  chapters?: { id: string; title: string; text: string }[];
};

export const fetchParallelFromUrl = async (
  options: FetchParallelUrlOptions,
  fetchImpl?: UrlFetchFn,
): Promise<ParallelUrlFetchResponse> => {
  const url = String(options.url || '').trim();
  if (!url) throw new Error('Missing URL.');

  const ctextHint = unsupportedCtextUrlMessage(url);
  if (ctextHint) throw new Error(ctextHint);

  if (isCtextWikiUrl(url)) {
    const result = await fetchCtextWikiParallel({
      url,
      section: options.section,
      contains: options.contains,
    });
    return {
      text: result.text,
      label: result.label,
      kind: 'ctext',
      url,
      section: result.section,
      rowId: result.rowId,
      rowIds: result.rowIds,
      sections: result.sections,
    };
  }

  if (isWikisourceUrl(url)) {
    return fetchWikisourceParallel({ url, fetchAll: options.fetchAll });
  }

  return fetchGenericUrlParallel(url, fetchImpl);
};
