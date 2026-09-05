import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface WikisourceParallelResult {
  text: string;
  label: string;
  kind: 'wikisource';
  url: string;
  pageTitle?: string;
  sections?: { id: string; slug: string; title: string; rowCount: number }[];
  chapters?: { id: string; title: string; text: string }[];
}

export interface FetchWikisourceParallelOptions {
  url: string;
  fetchAll?: boolean;
}

const resolveWikisourceModule = (): string => {
  const candidates = [
    path.join(__dirname, 'wikisource', 'wikisource-parallel.mjs'),
    path.resolve(__dirname, '../src/wikisource/wikisource-parallel.mjs'),
  ];
  const hit = candidates.find((candidate) => fs.existsSync(candidate));
  if (!hit) {
    throw new Error('wikisource-parallel.mjs not found in the Grognard desktop bundle.');
  }
  return hit;
};

export const getWikisourceModulePath = (): string => resolveWikisourceModule();

export const loadWikisourceModule = async () => {
  const modulePath = resolveWikisourceModule();
  return import(pathToFileURL(modulePath).href);
};

export const fetchWikisourceParallel = async (
  options: FetchWikisourceParallelOptions,
): Promise<WikisourceParallelResult> => {
  const mod = (await loadWikisourceModule()) as {
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
  const mod = (await loadWikisourceModule()) as {
    listWikisourceCatalog: (
      url: string,
    ) => Promise<{ id: string; slug: string; title: string; rowCount: number }[]>;
  };
  return mod.listWikisourceCatalog(url);
};
