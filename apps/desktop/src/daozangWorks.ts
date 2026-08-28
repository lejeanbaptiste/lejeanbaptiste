import fs from 'node:fs';
import { daozangIndexPath } from './daozangCorpus';

export interface DaozangWorkIndexEntry {
  id: string;
  dz_no: string;
  title: string;
  variant: string;
  rel_path: string;
  bytes: number;
}

let indexCache: { indexPath: string; entries: DaozangWorkIndexEntry[] } | null = null;

const loadDaozangIndex = (): DaozangWorkIndexEntry[] => {
  const indexPath = daozangIndexPath();
  if (indexCache?.indexPath === indexPath) return indexCache.entries;
  if (!fs.existsSync(indexPath)) return [];
  const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as DaozangWorkIndexEntry[];
  indexCache = { indexPath, entries };
  return entries;
};

export const searchDaozangWorks = (query: string, limit = 40): DaozangWorkIndexEntry[] => {
  const entries = loadDaozangIndex();
  const q = query.trim();
  if (!q) return entries.slice(0, Math.min(30, entries.length));
  const lower = q.toLowerCase();
  const matched = entries.filter((entry) => {
    if (entry.id.toLowerCase().includes(lower)) return true;
    if (entry.title.includes(q)) return true;
    if (entry.dz_no.includes(q) || entry.dz_no === q.replace(/^0+/, '')) return true;
    if (entry.rel_path.toLowerCase().includes(lower)) return true;
    return false;
  });
  matched.sort((a, b) => {
    const aExact = a.dz_no === q.replace(/^DZ/i, '').replace(/^0+/, '') ? 0 : 1;
    const bExact = b.dz_no === q.replace(/^DZ/i, '').replace(/^0+/, '') ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.dz_no.padStart(5, '0').localeCompare(b.dz_no.padStart(5, '0'));
  });
  return matched.slice(0, limit);
};

export const clearDaozangIndexCache = (): void => {
  indexCache = null;
};
