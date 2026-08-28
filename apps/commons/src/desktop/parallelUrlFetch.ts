/**
 * Fetch punctuated plain text from Wikisource (MediaWiki API) or generic HTTPS pages.
 */

export type ParallelUrlKind = 'wikisource' | 'generic' | 'ctext';

export interface ParallelUrlFetchResult {
  text: string;
  label: string;
  kind: ParallelUrlKind;
  url: string;
  pageTitle?: string;
}

export type UrlFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const WIKISOURCE_HOST_RE =
  /^(?:[a-z-]+\.)?wikisource\.org$/i;

/** Parse `{lang}.wikisource.org/wiki/{title}` or variant paths like `/zh-hant/{title}`. */
export const parseWikisourceUrl = (url: string): { apiHost: string; title: string } | null => {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!WIKISOURCE_HOST_RE.test(parsed.hostname)) return null;
  const match =
    parsed.pathname.match(/^\/wiki\/(.+)$/) ||
    parsed.pathname.match(/^\/[a-z]{2,3}(?:-[a-zA-Z]+)?\/(.+)$/);
  if (!match) return null;
  try {
    const title = decodeURIComponent(match[1].replace(/_/g, ' '));
    return { apiHost: parsed.hostname, title };
  } catch {
    return null;
  }
};

export const isWikisourceUrl = (url: string): boolean => parseWikisourceUrl(url) !== null;

export const isCtextWikiUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url.trim());
    return /(^|\.)ctext\.org$/i.test(parsed.hostname) && /wiki\.pl/i.test(parsed.pathname);
  } catch {
    return false;
  }
};

export const isCtextWikiResUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url.trim());
    return isCtextWikiUrl(url) && parsed.searchParams.has('res');
  } catch {
    return false;
  }
};

/** Build a ``chapter=`` wiki URL from a ``res=`` index URL and chapter id. */
export const ctextChapterUrlFromIndex = (indexUrl: string, chapterId: string): string | null => {
  try {
    const parsed = new URL(indexUrl.trim());
    parsed.searchParams.delete('res');
    parsed.searchParams.set('chapter', chapterId);
    return parsed.toString();
  } catch {
    return null;
  }
};

/** ctext.org reading/library URLs are not parallel sources — need ``wiki.pl?chapter=…``. */
export const unsupportedCtextUrlMessage = (url: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)ctext\.org$/i.test(parsed.hostname)) return null;
  if (isCtextWikiUrl(url)) return null;
  return (
    'ctext reading pages (library, text, search) cannot be used as parallel sources. ' +
    'Open the 李善 commentary wiki page and paste its URL instead ' +
    '(…/wiki.pl?…&chapter=… for one chapter, or …/wiki.pl?…&res=… for the whole-work index).'
  );
};

const assertFetchableHttpUrl = (url: string): URL => {
  const parsed = new URL(url.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported.');
  }
  return parsed;
};

interface MediaWikiParseResponse {
  parse?: {
    title: string;
    text?: { '*': string };
  };
  error?: { code?: string; info?: string };
}

/** Strip HTML from MediaWiki parse output to plain parallel text. */
export const htmlToParallelText = (html: string): string => {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<table\b[^>]*class="[^"]*\bmetadata\b[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '')
    .replace(/<div\b[^>]*id="headerContainer"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div\b[^>]*id="footer"[^>]*>[\s\S]*?<\/div>/gi, '');

  const text = withoutNoise
    .replace(/<\/?(?:p|div|br|h[1-6]|li|tr|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_match, digits: string) => {
      const code = Number.parseInt(digits, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const fetchWikisourceParallel = async (
  url: string,
  fetchImpl: UrlFetchFn = fetch,
): Promise<ParallelUrlFetchResult> => {
  const parsed = parseWikisourceUrl(url);
  if (!parsed) throw new Error('Not a Wikisource URL (expected …wikisource.org/wiki/…).');

  const apiUrl =
    `https://${parsed.apiHost}/w/api.php?` +
    new URLSearchParams({
      action: 'parse',
      page: parsed.title,
      prop: 'text',
      format: 'json',
      disablelimitreport: '1',
      disableeditsection: '1',
    }).toString();

  const response = await fetchImpl(apiUrl, {
    headers: { 'User-Agent': 'LJB/0.1 (Kanripo parallel fetch; +https://github.com/leJeanBaptiste)' },
  });
  if (!response.ok) {
    throw new Error(`Wikisource API HTTP ${response.status} for ${parsed.title}`);
  }

  const data = (await response.json()) as MediaWikiParseResponse;
  if (data.error) {
    throw new Error(data.error.info || data.error.code || 'Wikisource API error.');
  }

  const html = data.parse?.text?.['*'] ?? '';
  const text = htmlToParallelText(html);
  if (!text.trim()) {
    throw new Error(`Wikisource page “${parsed.title}” returned no readable text.`);
  }

  const pageTitle = data.parse?.title || parsed.title;
  return {
    text,
    label: `Wikisource: ${pageTitle}`,
    kind: 'wikisource',
    url: url.trim(),
    pageTitle,
  };
};

const MAX_GENERIC_BYTES = 2_000_000;

export const fetchGenericUrlParallel = async (
  url: string,
  fetchImpl: UrlFetchFn = fetch,
): Promise<ParallelUrlFetchResult> => {
  const parsed = assertFetchableHttpUrl(url);
  const response = await fetchImpl(parsed.toString(), {
    headers: { 'User-Agent': 'LJB/0.1 (Kanripo parallel fetch; +https://github.com/leJeanBaptiste)' },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${parsed.hostname}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_GENERIC_BYTES) {
    throw new Error(`Page too large (${buffer.byteLength} bytes; limit ${MAX_GENERIC_BYTES}).`);
  }
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const text = contentType.includes('html') ? htmlToParallelText(raw) : raw.trim();
  if (!text.trim()) {
    throw new Error('URL returned no readable text.');
  }

  return {
    text,
    label: parsed.hostname,
    kind: 'generic',
    url: parsed.toString(),
  };
};
