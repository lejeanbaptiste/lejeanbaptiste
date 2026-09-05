import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getCachedPluginHostSnapshot } from './plugins';

export interface CtextWikiParallelResult {
  text: string;
  label: string;
  section?: string;
  rowId?: string;
  rowIds?: string[];
  sections?: { id: string; slug: string; title: string; rowCount: number }[];
}

export interface FetchCtextWikiParallelOptions {
  url: string;
  row?: number | string;
  id?: string;
  contains?: string;
  section?: string;
  fetchAll?: boolean;
}

const resolveCtextWikiModule = (): string => {
  const plugin = getCachedPluginHostSnapshot()?.plugins.find(
    (item) => item.id === 'kanripo-import',
  );
  const candidates = [
    plugin?.installPath
      ? path.join(plugin.installPath, 'scripts', 'ctext-wiki-parallel.mjs')
      : null,
    path.resolve(
      __dirname,
      '../../../../plugins/packages/plugin-kanripo-import/scripts/ctext-wiki-parallel.mjs',
    ),
  ].filter(Boolean) as string[];
  const hit = candidates.find((candidate) => fs.existsSync(candidate));
  if (!hit) {
    throw new Error('ctext-wiki-parallel.mjs not found. Reinstall the Kanripo import plugin.');
  }
  return hit;
};

export const fetchCtextWikiParallel = async (
  options: FetchCtextWikiParallelOptions,
): Promise<CtextWikiParallelResult> => {
  const modulePath = resolveCtextWikiModule();
  const mod = (await import(pathToFileURL(modulePath).href)) as {
    fetchCtextWikiParallel: (
      opts: FetchCtextWikiParallelOptions,
    ) => Promise<CtextWikiParallelResult>;
  };
  return mod.fetchCtextWikiParallel(options);
};

export const listCtextWikiSections = async (
  url: string,
): Promise<{ id: string; slug: string; title: string; rowCount: number }[]> => {
  const modulePath = resolveCtextWikiModule();
  const mod = (await import(pathToFileURL(modulePath).href)) as {
    fetch: typeof fetch;
    listWikiCatalog: (
      html: string,
    ) => { id: string; slug: string; title: string; rowCount: number }[];
  };
  const html = await fetch(url, {
    headers: { 'User-Agent': 'grognard-plugin-kanripo-import/0.1 (+https://github.com/leJeanBaptiste)' },
  }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
  });
  return mod.listWikiCatalog(html);
};
