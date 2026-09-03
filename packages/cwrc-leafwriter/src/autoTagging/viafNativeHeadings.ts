/**
 * Native-script headings from a VIAF cluster.
 *
 * LINCS reconcile returns one Latin catalogue form. The cluster JSON (Accept:
 * application/json on `https://viaf.org/viaf/{id}`) still lists preferred and
 * alternate *name* headings, including `bo` / `zh` / `ja` script forms. Walking
 * the whole cluster is wrong: titles and publishers are often longer than the
 * personal name, so we only read `mainHeadings` and `x400` $a.
 *
 * Browser `fetch` to viaf.org fails (CORS preflight + Cloudflare). The desktop
 * app loads the cluster in the main process via `electronAPI.viafFetchCluster`.
 */

import { textMatchesProjectScript } from '../utilities/languageCodes';
import { autoRomanize } from '../utilities/romanize';

export type ViafFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const viafIdFromText = (text: string): string | null => {
  const match = text.match(/viaf\.org\/(?:[a-z]{2}\/)?viaf\/(\d+)/i);
  if (match) return match[1]!;
  const digits = text.trim();
  return /^\d+$/.test(digits) ? digits : null;
};

const asList = <T>(value: T | T[] | undefined | null): T[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

const localName = (key: string): string => {
  const cut = key.lastIndexOf(':');
  return cut >= 0 ? key.slice(cut + 1) : key;
};

const isLatinHeading = (text: string): boolean =>
  /[\p{Script=Latin}]/u.test(text) &&
  !/\p{Script=Tibetan}/u.test(text) &&
  !/\p{Script=Han}/u.test(text);

const NAME_SECTIONS = new Set(['mainHeadings', 'mainHeadingEl', 'x400s', 'x400']);

const pushHeading = (out: string[], value: string): void => {
  const trimmed = value.trim();
  if (trimmed) out.push(trimmed);
};

const collectNameTexts = (node: unknown, out: string[]): void => {
  if (node == null) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectNameTexts(item, out));
    return;
  }
  if (typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    const name = localName(key);
    if (name === 'text' && typeof value === 'string') pushHeading(out, value);
    if (name === 'subfield') {
      for (const field of asList(value as Record<string, unknown> | Record<string, unknown>[])) {
        if (!field || typeof field !== 'object') continue;
        const code = String((field as { code?: unknown }).code ?? '');
        const content =
          typeof (field as { content?: unknown }).content === 'string'
            ? (field as { content: string }).content
            : typeof (field as { '#text'?: unknown })['#text'] === 'string'
              ? (field as { '#text': string })['#text']
              : '';
        if (code === 'a' && content.trim()) pushHeading(out, content);
      }
    }
    collectNameTexts(value, out);
  }
};

const walkForNameSections = (node: unknown, out: string[]): void => {
  if (node == null) return;
  if (Array.isArray(node)) {
    node.forEach((item) => walkForNameSections(item, out));
    return;
  }
  if (typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (NAME_SECTIONS.has(localName(key))) collectNameTexts(value, out);
    else walkForNameSections(value, out);
  }
};

/** Collect personal-name headings (not titles/publishers) from a VIAF cluster JSON tree. */
export function collectViafHeadingTexts(payload: unknown): string[] {
  const out: string[] = [];
  walkForNameSections(payload, out);
  return [...new Set(out)];
}

const stripCatalogueDates = (text: string): string =>
  text
    .replace(/,?\s*[0-9]{3,4}\s*[-–]\s*(?:[0-9]{3,4})?\s*$/u, '')
    .replace(/[.,;:]+$/u, '')
    .trim();

const foldRoman = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

const overlapScore = (left: string, right: string): number => {
  if (!left || !right) return 0;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (longer.includes(shorter)) return shorter.length / longer.length;
  let hits = 0;
  let index = 0;
  for (const ch of shorter) {
    const found = longer.indexOf(ch, index);
    if (found >= 0) {
      hits += 1;
      index = found + 1;
    }
  }
  return hits / longer.length;
};

/**
 * Prefer the heading in the project's native script that matches the cluster's
 * Latin preferred form (so we do not pick a longer alternate or a related person).
 */
export function pickNativeViafHeading(
  headings: string[],
  projectLang: string | null | undefined,
  preferredLatin?: string | null,
): string | null {
  const native = headings
    .map((heading) => stripCatalogueDates(heading))
    .filter((heading) => textMatchesProjectScript(heading, projectLang));
  if (native.length === 0) return null;
  if (!preferredLatin) {
    return [...native].sort((left, right) => right.length - left.length)[0] ?? null;
  }
  const foldedPreferred = foldRoman(stripCatalogueDates(preferredLatin));
  const ranked = native
    .map((heading) => {
      const roman = autoRomanize(heading, projectLang) ?? '';
      return { heading, score: overlapScore(foldRoman(roman), foldedPreferred) };
    })
    .sort((left, right) => right.score - left.score || right.heading.length - left.heading.length);
  const best = ranked[0];
  if (best && best.score >= 0.45) return best.heading;
  return [...native].sort((left, right) => right.length - left.length)[0] ?? null;
}

const viafHeadingCache = new Map<string, string[]>();
const viafPreferredCache = new Map<string, string | null>();

export function clearViafHeadingCacheForTests(): void {
  viafHeadingCache.clear();
  viafPreferredCache.clear();
}

const desktopViafFetch = (): ((id: string) => Promise<unknown>) | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.electronAPI?.viafFetchCluster;
};

async function loadViafCluster(id: string, fetchImpl: ViafFetchFn): Promise<unknown> {
  const desktop = desktopViafFetch();
  if (desktop && fetchImpl === fetch) {
    return desktop(id);
  }
  const url = `https://viaf.org/viaf/${id}`;
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const type = response.headers?.get?.('content-type') ?? '';
  if (type && !/json/i.test(type)) return null;
  return response.json();
}

export async function fetchViafHeadingTexts(
  viafId: string,
  fetchImpl: ViafFetchFn = fetch,
): Promise<string[]> {
  const id = viafId.replace(/\D/g, '');
  if (!id) return [];
  const cached = viafHeadingCache.get(id);
  if (cached) return cached;
  try {
    const payload = await loadViafCluster(id, fetchImpl);
    const texts = collectViafHeadingTexts(payload);
    const preferred = texts.find((heading) => isLatinHeading(heading)) ?? texts[0] ?? null;
    viafHeadingCache.set(id, texts);
    viafPreferredCache.set(id, preferred);
    return texts;
  } catch {
    viafHeadingCache.set(id, []);
    viafPreferredCache.set(id, null);
    return [];
  }
}

export async function viafNativeHeadingForId(
  viafId: string,
  projectLang: string | null | undefined,
  fetchImpl: ViafFetchFn = fetch,
): Promise<string | null> {
  if (!projectLang) return null;
  try {
    const texts = await fetchViafHeadingTexts(viafId, fetchImpl);
    const id = viafId.replace(/\D/g, '');
    return pickNativeViafHeading(texts, projectLang, viafPreferredCache.get(id));
  } catch {
    return null;
  }
}

export function viafIdsOnCandidate(candidate: {
  uri?: string;
  description?: string;
  authorityIds?: { type: string; value: string }[];
}): string[] {
  const ids = new Set<string>();
  const add = (text: string | undefined) => {
    const id = text ? viafIdFromText(text) : null;
    if (id) ids.add(id);
  };
  add(candidate.uri);
  add(candidate.description);
  for (const auth of candidate.authorityIds ?? []) {
    if (/^viaf$/i.test(auth.type)) add(auth.value);
  }
  return [...ids];
}
