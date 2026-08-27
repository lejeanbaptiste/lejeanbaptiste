import fs from 'node:fs';
import path from 'node:path';
import { getCachedPluginHostSnapshot } from './plugins';

export interface KanripoWorkIndexEntry {
  id: string;
  title: string;
  author?: string;
  dynasty?: string;
}

let worksCache: { installPath: string; works: KanripoWorkIndexEntry[] } | null = null;

const loadKanripoWorks = (): KanripoWorkIndexEntry[] => {
  const plugin = getCachedPluginHostSnapshot()?.plugins.find((p) => p.id === 'kanripo-import');
  if (!plugin) return [];
  if (worksCache?.installPath === plugin.installPath) return worksCache.works;
  const indexPath = path.join(plugin.installPath, 'data', 'krp_works.json');
  if (!fs.existsSync(indexPath)) return [];
  const works = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as KanripoWorkIndexEntry[];
  worksCache = { installPath: plugin.installPath, works };
  return works;
};

export const searchKanripoWorks = (
  query: string,
  limit = 40,
): KanripoWorkIndexEntry[] => {
  const works = loadKanripoWorks();
  const q = query.trim();
  if (!q) return works.slice(0, Math.min(30, works.length));
  const lower = q.toLowerCase();
  const matched = works.filter((work) => {
    if (work.id.toLowerCase().includes(lower)) return true;
    if (work.title.includes(q)) return true;
    if (work.author && work.author.includes(q)) return true;
    return false;
  });
  matched.sort((a, b) => {
    const aPrefix = a.id.toLowerCase().startsWith(lower) ? 0 : 1;
    const bPrefix = b.id.toLowerCase().startsWith(lower) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.id.localeCompare(b.id);
  });
  return matched.slice(0, limit);
};
