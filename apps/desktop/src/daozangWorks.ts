import fs from 'node:fs';
import { daozangIndexPath } from './daozangCorpus';

/** Rows of the bundled index.json, which already carries the work metadata. */
export interface DaozangWorkIndexEntry {
  id: string;
  dz_no: string;
  title: string;
  /** Daozang section (部/類), e.g. 正統道藏洞真部本文類. */
  section: string;
  dynasty: string;
  authors: string;
  /** Title as filed, set only where one DZ number covers several files (早/午/晚朝). */
  file_title: string;
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
    if (entry.file_title.includes(q)) return true;
    if (entry.dz_no.includes(q) || entry.dz_no === q.replace(/^0+/, '')) return true;
    if (entry.section.includes(q)) return true;
    if (entry.dynasty.includes(q)) return true;
    if (entry.authors.includes(q)) return true;
    if (entry.rel_path.toLowerCase().includes(lower)) return true;
    return false;
  });
  const dzKey = (entry: DaozangWorkIndexEntry) =>
    entry.dz_no ? entry.dz_no.padStart(5, '0') : '99999';
  const exact = q.replace(/^DZ/i, '').replace(/^0+/, '');
  matched.sort((a, b) => {
    const aExact = a.dz_no === exact ? 0 : 1;
    const bExact = b.dz_no === exact ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return dzKey(a) === dzKey(b)
      ? a.title.localeCompare(b.title)
      : dzKey(a).localeCompare(dzKey(b));
  });
  return matched.slice(0, limit);
};
