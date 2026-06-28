import { joinProjectPath } from '@src/desktop/projectFile';

export const TAG_STATS_RELATIVE_PATH = 'schema/tag-stats.json';

export interface TagUsageStats {
  version: 1;
  project: {
    tags: Record<string, number>;
    attrs: Record<string, Record<string, number>>;
    attrValues: Record<string, Record<string, Record<string, number>>>;
  };
  files: Record<
    string,
    {
      tags: Record<string, number>;
      attrs: Record<string, Record<string, number>>;
      attrValues: Record<string, Record<string, Record<string, number>>>;
    }
  >;
}

const emptyStats = (): TagUsageStats => ({
  version: 1,
  project: { tags: {}, attrs: {}, attrValues: {} },
  files: {},
});

let cachedStats: TagUsageStats | null = null;
let cachedRootPath: string | null = null;

export const getTagStatsPath = (rootPath: string) =>
  joinProjectPath(rootPath, TAG_STATS_RELATIVE_PATH);

const toRelativePath = (rootPath: string, filePath: string): string =>
  filePath.slice(rootPath.length).replace(/^[/\\]+/, '').replace(/\\/g, '/');

export const countTagsInXml = (xml: string): Record<string, number> => {
  const counts: Record<string, number> = {};
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return counts;

  const walk = (element: Element) => {
    const name = element.localName || element.tagName;
    if (name) counts[name] = (counts[name] ?? 0) + 1;
    for (const child of element.children) {
      walk(child as Element);
    }
  };

  if (doc.documentElement) walk(doc.documentElement);
  return counts;
};

export const mergeFileCountsIntoProject = (
  stats: TagUsageStats,
  relativePath: string,
  fileCounts: Record<string, number>,
): TagUsageStats => {
  const previous = stats.files[relativePath]?.tags ?? {};
  const nextProject = { ...stats.project.tags };

  for (const [tag, count] of Object.entries(previous)) {
    nextProject[tag] = Math.max(0, (nextProject[tag] ?? 0) - count);
    if (nextProject[tag] === 0) delete nextProject[tag];
  }

  for (const [tag, count] of Object.entries(fileCounts)) {
    nextProject[tag] = (nextProject[tag] ?? 0) + count;
  }

  return {
    ...stats,
    project: { ...stats.project, tags: nextProject },
    files: {
      ...stats.files,
      [relativePath]: {
        tags: fileCounts,
        attrs: {},
        attrValues: {},
      },
    },
  };
};

export const loadTagStats = async (rootPath: string): Promise<TagUsageStats> => {
  if (cachedStats && cachedRootPath === rootPath) return cachedStats;

  if (!window.electronAPI?.readFile) {
    cachedStats = emptyStats();
    cachedRootPath = rootPath;
    return cachedStats;
  }

  const statsPath = getTagStatsPath(rootPath);
  try {
    if (window.electronAPI.statFile) {
      try {
        await window.electronAPI.statFile(statsPath);
      } catch {
        cachedStats = emptyStats();
        cachedRootPath = rootPath;
        return cachedStats;
      }
    }
    const raw = await window.electronAPI.readFile(statsPath);
    const parsed = JSON.parse(raw) as TagUsageStats;
    cachedStats = {
      version: 1,
      project: {
        tags: parsed.project?.tags ?? {},
        attrs: {},
        attrValues: {},
      },
      files: parsed.files ?? {},
    };
  } catch {
    cachedStats = emptyStats();
  }

  cachedRootPath = rootPath;
  return cachedStats;
};

export const saveTagStats = async (rootPath: string, stats: TagUsageStats): Promise<void> => {
  if (!window.electronAPI?.writeFile) return;
  cachedStats = stats;
  cachedRootPath = rootPath;
  try {
    await window.electronAPI.writeFile(getTagStatsPath(rootPath), JSON.stringify(stats, null, 2));
  } catch {
    // Stats are optional; never block save or file open.
  }
};

export const getProjectTagCounts = (stats: TagUsageStats): Record<string, number> =>
  stats.project.tags;

export const updateTagStatsForFile = async (
  rootPath: string,
  filePath: string,
  xml: string,
): Promise<TagUsageStats> => {
  const stats = await loadTagStats(rootPath);
  const relativePath = toRelativePath(rootPath, filePath);
  const fileCounts = countTagsInXml(xml);
  const merged = mergeFileCountsIntoProject(stats, relativePath, fileCounts);
  await saveTagStats(rootPath, merged);
  return merged;
};

export const clearTagStatsCache = () => {
  cachedStats = null;
  cachedRootPath = null;
};
