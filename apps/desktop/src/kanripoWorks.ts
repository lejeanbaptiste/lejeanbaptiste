import fs from 'node:fs';
import path from 'node:path';
import { getCachedPluginHostSnapshot, resolveDevPluginSourcePath } from './plugins';

/** Rows of the bundled krp_works.json, which already carries the work metadata. */
export interface KanripoWorkIndexEntry {
  id: string;
  title: string;
  /** Kanripo 部・類, e.g. 經部・易類. */
  section: string;
  dynasty: string;
  authors: string;
  /** DZ number of the parallel Daozang text, where there is one. */
  dzid: string;
}

let worksCache: { indexPath: string; works: KanripoWorkIndexEntry[] } | null = null;

/** The dev source tree when running unpackaged, else the installed copy. */
const kanripoWorksPath = (): string | null => {
  const candidates: string[] = [];
  const dev = resolveDevPluginSourcePath('kanripo-import');
  if (dev) candidates.push(path.join(dev, 'data', 'krp_works.json'));
  const plugin = getCachedPluginHostSnapshot()?.plugins.find((p) => p.id === 'kanripo-import');
  if (plugin?.installPath) candidates.push(path.join(plugin.installPath, 'data', 'krp_works.json'));
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
};

const loadKanripoWorks = (): KanripoWorkIndexEntry[] => {
  const indexPath = kanripoWorksPath();
  if (!indexPath) return [];
  if (worksCache?.indexPath === indexPath) return worksCache.works;
  const works = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as KanripoWorkIndexEntry[];
  worksCache = { indexPath, works };
  return works;
};

export const searchKanripoWorks = (query: string, limit = 40): KanripoWorkIndexEntry[] => {
  const works = loadKanripoWorks();
  const q = query.trim();
  if (!q) return works.slice(0, Math.min(30, works.length));
  const lower = q.toLowerCase();
  const matched = works.filter((work) => {
    if (work.id.toLowerCase().includes(lower)) return true;
    if (work.title.includes(q)) return true;
    if (work.section.includes(q)) return true;
    if (work.dynasty.includes(q)) return true;
    if (work.authors.includes(q)) return true;
    if (work.dzid.toLowerCase().includes(lower)) return true;
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
