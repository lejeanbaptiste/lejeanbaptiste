/**
 * Client for the Zotero 7 desktop app's local HTTP server (port 23119), used to look up
 * citations for translation footnotes. Runs in the Electron main process so requests are
 * not subject to renderer CORS restrictions.
 *
 * Endpoints (verified against Zotero 7 + Better BibTeX):
 * - GET /connector/ping — 200 whenever Zotero is running (works with local API disabled).
 * - GET /api/... — Zotero's local web API; returns 403 "Local API is not enabled" unless
 *   the user enables it in Settings → Advanced.
 * - POST /better-bibtex/json-rpc — BBT's JSON-RPC; item.search returns CSL-JSON items
 *   whose `id` is the canonical Zotero item URI. Available whenever BBT is installed.
 * - GET /better-bibtex/cayw — BBT's cite-as-you-write picker; blocks until the user picks
 *   or cancels in Zotero.
 */

const ZOTERO_BASE = 'http://localhost:23119';
const PROBE_TIMEOUT_MS = 2500;
const SEARCH_TIMEOUT_MS = 10000;

export interface ZoteroStyle {
  id: string;
  label: string;
  xml: string;
}

export interface ZoteroAvailability {
  /** Zotero desktop is running. */
  running: boolean;
  /** The local web API is enabled in Zotero's settings. */
  localApi: boolean;
  /** Better BibTeX is installed (enables search fallback and the CAYW picker). */
  betterBibtex: boolean;
}

/** CSL-JSON item plus the Zotero URI it came from. */
export interface ZoteroSearchResult {
  uri: string;
  csl: Record<string, unknown>;
}

export interface ZoteroCaywPick {
  uri: string;
  csl: Record<string, unknown>;
  locator?: string;
  label?: string;
  prefix?: string;
  suffix?: string;
}

export type ZoteroCaywResult =
  | { ok: true; picks: ZoteroCaywPick[] }
  | { ok: false; cancelled: boolean; error?: string };

const probe = async (path: string): Promise<Response | null> => {
  try {
    return await fetch(`${ZOTERO_BASE}${path}`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
};

export const checkZoteroAvailability = async (): Promise<ZoteroAvailability> => {
  const ping = await probe('/connector/ping');
  if (!ping?.ok) return { running: false, localApi: false, betterBibtex: false };

  const [api, bbt] = await Promise.all([probe('/api/'), probe('/better-bibtex/cayw?probe=true')]);
  return {
    running: true,
    localApi: api?.ok ?? false,
    betterBibtex: bbt?.ok ?? false,
  };
};

/** The Zotero URI is the CSL id in BBT results; the local API carries it in links.self. */
const uriFromCslId = (csl: Record<string, unknown>): string | undefined => {
  const id = csl.id;
  return typeof id === 'string' && id.startsWith('http') ? id : undefined;
};

const searchViaLocalApi = async (query: string): Promise<ZoteroSearchResult[]> => {
  const response = await fetch(
    `${ZOTERO_BASE}/api/users/0/items?q=${encodeURIComponent(query)}&itemType=-attachment&include=csljson,data&limit=25`,
    { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) },
  );
  if (!response.ok) throw new Error(`Zotero local API returned ${response.status}`);
  const items = (await response.json()) as {
    key?: string;
    library?: { id?: number };
    links?: { self?: { href?: string } };
    data?: Record<string, unknown>;
    csljson?: Record<string, unknown>;
  }[];

  // Ask for CSL-JSON per item set via include=csljson; when absent fall back to data.
  return items
    .map((item) => {
      const csl = item.csljson ?? item.data;
      const uri = item.links?.self?.href;
      if (!csl || !uri) return undefined;
      return { uri, csl } satisfies ZoteroSearchResult;
    })
    .filter((result): result is ZoteroSearchResult => result !== undefined);
};

const bbtRpc = async <T>(method: string, params: unknown[], timeoutMs: number): Promise<T> => {
  const response = await fetch(`${ZOTERO_BASE}/better-bibtex/json-rpc`, {
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Better BibTeX returned ${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? 'Better BibTeX error');
  return body.result as T;
};

const searchViaBetterBibtex = async (query: string): Promise<ZoteroSearchResult[]> => {
  const items = await bbtRpc<Record<string, unknown>[]>('item.search', [query], SEARCH_TIMEOUT_MS);
  return items
    .map((csl) => {
      const uri = uriFromCslId(csl);
      if (!uri) return undefined;
      // `library`/`citekey` are BBT extras, not CSL — keep them out of the snapshot.
      const { library: _library, citekey: _citekey, ...rest } = csl;
      return { uri, csl: rest } satisfies ZoteroSearchResult;
    })
    .filter((result): result is ZoteroSearchResult => result !== undefined);
};

export const searchZoteroItems = async (query: string): Promise<ZoteroSearchResult[]> => {
  if (!query.trim()) return [];
  const availability = await checkZoteroAvailability();
  if (!availability.running) throw new Error('Zotero is not running.');

  if (availability.localApi) {
    try {
      return await searchViaLocalApi(query);
    } catch {
      // fall through to BBT
    }
  }
  if (availability.betterBibtex) return searchViaBetterBibtex(query);
  throw new Error(
    'Enable the local API in Zotero (Settings → Advanced → "Allow other applications on this computer to communicate with Zotero") or install Better BibTeX.',
  );
};

const parseTagText = (xml: string, tagName: string): string | undefined => {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match?.[1]
    ?.replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

const styleIdFromXml = (xml: string, fallback: string): string => {
  const id = parseTagText(xml, 'id');
  const last = id?.replace(/\/+$/, '').split('/').pop();
  return last || fallback;
};

export const listZoteroStyles = async (): Promise<ZoteroStyle[]> => {
  const { app } = await import('electron');
  const { promises: fs } = await import('fs');
  const path = await import('path');

  const stylesDir = path.join(app.getPath('home'), 'Zotero', 'styles');
  let entries: string[];
  try {
    entries = await fs.readdir(stylesDir);
  } catch {
    return [];
  }

  const styles: ZoteroStyle[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.csl')) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const xml = await fs.readFile(path.join(stylesDir, entry), 'utf-8');
      const fallbackId = entry.replace(/\.csl$/, '');
      styles.push({
        id: styleIdFromXml(xml, fallbackId),
        label: parseTagText(xml, 'title') || fallbackId,
        xml,
      });
    } catch {
      // Ignore unreadable styles; Zotero will recreate/update these as needed.
    }
  }

  return styles.sort((a, b) => a.label.localeCompare(b.label));
};

/** Resolves a CAYW pick (identified by citation key) to a full CSL-JSON item via BBT. */
const resolveCitekey = async (citekey: string): Promise<ZoteroSearchResult | undefined> => {
  const results = await searchViaBetterBibtex(citekey);
  return results.find((result) => result.csl['citation-key'] === citekey) ?? results[0];
};

let caywAbort: AbortController | null = null;

export const cancelZoteroPick = (): void => {
  caywAbort?.abort();
  caywAbort = null;
};

/**
 * Opens Zotero's own citation picker (BBT CAYW). Blocks until the user confirms or
 * cancels in Zotero; cancellable from our side via cancelZoteroPick.
 */
export const pickZoteroCitationCayw = async (): Promise<ZoteroCaywResult> => {
  const availability = await checkZoteroAvailability();
  if (!availability.running)
    return { ok: false, cancelled: false, error: 'Zotero is not running.' };
  if (!availability.betterBibtex) {
    return { ok: false, cancelled: false, error: 'Better BibTeX is not installed in Zotero.' };
  }

  cancelZoteroPick();
  caywAbort = new AbortController();
  try {
    const response = await fetch(`${ZOTERO_BASE}/better-bibtex/cayw?format=json`, {
      signal: caywAbort.signal,
    });
    if (!response.ok) {
      return { ok: false, cancelled: false, error: `Zotero picker returned ${response.status}` };
    }
    const raw = (await response.json()) as {
      citekey?: string;
      citationKey?: string;
      locator?: string;
      label?: string;
      prefix?: string;
      suffix?: string;
    }[];

    const picks: ZoteroCaywPick[] = [];
    for (const entry of raw) {
      const citekey = entry.citekey ?? entry.citationKey;
      if (!citekey) continue;
      const resolved = await resolveCitekey(citekey);
      if (!resolved) continue;
      picks.push({
        uri: resolved.uri,
        csl: resolved.csl,
        locator: entry.locator || undefined,
        label: entry.label || undefined,
        prefix: entry.prefix || undefined,
        suffix: entry.suffix || undefined,
      });
    }
    // An empty selection confirmed in Zotero is indistinguishable from "nothing picked";
    // treat it as a cancel so the caller doesn't insert an empty citation.
    if (picks.length === 0) return { ok: false, cancelled: true };
    return { ok: true, picks };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      cancelled: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    caywAbort = null;
  }
};
