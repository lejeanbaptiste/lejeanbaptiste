import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getCachedPluginHostSnapshot } from './plugins';

export interface WikisourceParallelResult {
  text: string;
  label: string;
  kind: 'wikisource';
  url: string;
  pageTitle?: string;
  sections?: { id: string; slug: string; title: string; rowCount: number }[];
}

export interface FetchWikisourceParallelOptions {
  url: string;
  fetchAll?: boolean;
}

const resolveWikisourceModule = (): string => {
  const plugin = getCachedPluginHostSnapshot()?.plugins.find(
    (item) => item.id === 'kanripo-import',
  );
  const candidates = [
    plugin?.installPath
      ? path.join(plugin.installPath, 'scripts', 'wikisource-parallel.mjs')
      : null,
    path.resolve(
      __dirname,
      '../../../../plugins/packages/plugin-kanripo-import/scripts/wikisource-parallel.mjs',
    ),
  ].filter(Boolean) as string[];
  const hit = candidates.find((candidate) => fs.existsSync(candidate));
  if (!hit) {
    throw new Error('wikisource-parallel.mjs not found. Reinstall the Kanripo import plugin.');
  }
  return hit;
};

export const fetchWikisourceParallel = async (
  options: FetchWikisourceParallelOptions,
): Promise<WikisourceParallelResult> => {
  const modulePath = resolveWikisourceModule();
  const mod = (await import(pathToFileURL(modulePath).href)) as {
    fetchWikisourceParallel: (
      url: string,
      opts: FetchWikisourceParallelOptions,
    ) => Promise<WikisourceParallelResult>;
  };
  return mod.fetchWikisourceParallel(options.url, options);
};

export const listWikisourceCatalog = async (
  url: string,
): Promise<{ id: string; slug: string; title: string; rowCount: number }[]> => {
  const modulePath = resolveWikisourceModule();
  const mod = (await import(pathToFileURL(modulePath).href)) as {
    listWikisourceCatalog: (
      url: string,
    ) => Promise<{ id: string; slug: string; title: string; rowCount: number }[]>;
  };
  return mod.listWikisourceCatalog(url);
};
