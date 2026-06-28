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

export interface FileUsageCounts {
  tags: Record<string, number>;
  attrs: Record<string, Record<string, number>>;
  attrValues: Record<string, Record<string, Record<string, number>>>;
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

const RESERVED_ATTR_NAMES = new Set([
  'id',
  'xmlns',
  'xml:lang',
  'xml:space',
  '_tag',
  '_attributes',
  '_entity',
  'data-mce-type',
]);

const subtractNestedCounts = <T extends Record<string, number>>(
  target: Record<string, T>,
  key: string,
  counts: T,
): void => {
  if (!target[key]) return;
  for (const [name, count] of Object.entries(counts)) {
    target[key]![name] = Math.max(0, (target[key]![name] ?? 0) - count);
    if (target[key]![name] === 0) delete target[key]![name];
  }
  if (Object.keys(target[key]!).length === 0) delete target[key];
};

const addNestedCounts = <T extends Record<string, number>>(
  target: Record<string, T>,
  key: string,
  counts: T,
): void => {
  if (!target[key]) target[key] = {} as T;
  for (const [name, count] of Object.entries(counts)) {
    target[key]![name] = (target[key]![name] ?? 0) + count;
  }
};

const subtractAttrValueCounts = (
  target: Record<string, Record<string, Record<string, number>>>,
  tagName: string,
  attrCounts: Record<string, Record<string, number>>,
): void => {
  const tagBucket = target[tagName];
  if (!tagBucket) return;
  for (const [attrName, valueCounts] of Object.entries(attrCounts)) {
    const attrBucket = tagBucket[attrName];
    if (!attrBucket) continue;
    for (const [value, count] of Object.entries(valueCounts)) {
      attrBucket[value] = Math.max(0, (attrBucket[value] ?? 0) - count);
      if (attrBucket[value] === 0) delete attrBucket[value];
    }
    if (Object.keys(attrBucket).length === 0) delete tagBucket[attrName];
  }
  if (Object.keys(tagBucket).length === 0) delete target[tagName];
};

const addAttrValueCounts = (
  target: Record<string, Record<string, Record<string, number>>>,
  tagName: string,
  attrCounts: Record<string, Record<string, number>>,
): void => {
  if (!target[tagName]) target[tagName] = {};
  for (const [attrName, valueCounts] of Object.entries(attrCounts)) {
    if (!target[tagName]![attrName]) target[tagName]![attrName] = {};
    for (const [value, count] of Object.entries(valueCounts)) {
      target[tagName]![attrName]![value] = (target[tagName]![attrName]![value] ?? 0) + count;
    }
  }
};

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

export const countAttrsInXml = (
  xml: string,
): Pick<FileUsageCounts, 'attrs' | 'attrValues'> => {
  const attrs: Record<string, Record<string, number>> = {};
  const attrValues: Record<string, Record<string, Record<string, number>>> = {};
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return { attrs, attrValues };

  const recordAttr = (tagName: string, attrName: string, value: string) => {
    if (RESERVED_ATTR_NAMES.has(attrName)) return;
    if (!attrs[tagName]) attrs[tagName] = {};
    attrs[tagName]![attrName] = (attrs[tagName]![attrName] ?? 0) + 1;
    if (!attrValues[tagName]) attrValues[tagName] = {};
    if (!attrValues[tagName]![attrName]) attrValues[tagName]![attrName] = {};
    attrValues[tagName]![attrName]![value] = (attrValues[tagName]![attrName]![value] ?? 0) + 1;
  };

  const walk = (element: Element) => {
    const tagName = element.localName || element.tagName;
    if (tagName) {
      for (const attr of Array.from(element.attributes)) {
        recordAttr(tagName, attr.name, attr.value);
      }
    }
    for (const child of element.children) {
      walk(child as Element);
    }
  };

  if (doc.documentElement) walk(doc.documentElement);
  return { attrs, attrValues };
};

export const countUsageInXml = (xml: string): FileUsageCounts => ({
  tags: countTagsInXml(xml),
  ...countAttrsInXml(xml),
});

export const mergeFileCountsIntoProject = (
  stats: TagUsageStats,
  relativePath: string,
  fileCounts: FileUsageCounts,
): TagUsageStats => {
  const previous = stats.files[relativePath];
  const nextProjectTags = { ...stats.project.tags };
  const nextProjectAttrs = JSON.parse(JSON.stringify(stats.project.attrs)) as TagUsageStats['project']['attrs'];
  const nextProjectAttrValues = JSON.parse(
    JSON.stringify(stats.project.attrValues),
  ) as TagUsageStats['project']['attrValues'];

  if (previous) {
    for (const [tag, count] of Object.entries(previous.tags)) {
      nextProjectTags[tag] = Math.max(0, (nextProjectTags[tag] ?? 0) - count);
      if (nextProjectTags[tag] === 0) delete nextProjectTags[tag];
    }
    for (const [tagName, attrCounts] of Object.entries(previous.attrs)) {
      subtractNestedCounts(nextProjectAttrs, tagName, attrCounts);
    }
    for (const [tagName, attrValueCounts] of Object.entries(previous.attrValues)) {
      subtractAttrValueCounts(nextProjectAttrValues, tagName, attrValueCounts);
    }
  }

  for (const [tag, count] of Object.entries(fileCounts.tags)) {
    nextProjectTags[tag] = (nextProjectTags[tag] ?? 0) + count;
  }
  for (const [tagName, attrCounts] of Object.entries(fileCounts.attrs)) {
    addNestedCounts(nextProjectAttrs, tagName, attrCounts);
  }
  for (const [tagName, attrValueCounts] of Object.entries(fileCounts.attrValues)) {
    addAttrValueCounts(nextProjectAttrValues, tagName, attrValueCounts);
  }

  return {
    ...stats,
    project: {
      tags: nextProjectTags,
      attrs: nextProjectAttrs,
      attrValues: nextProjectAttrValues,
    },
    files: {
      ...stats.files,
      [relativePath]: fileCounts,
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
        attrs: parsed.project?.attrs ?? {},
        attrValues: parsed.project?.attrValues ?? {},
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

export const getProjectAttrCounts = (
  stats: TagUsageStats,
  tagName: string,
): Record<string, number> => stats.project.attrs[tagName] ?? {};

export const getAttrValueCounts = (
  stats: TagUsageStats,
  tagName: string,
  attrName: string,
): Record<string, number> => stats.project.attrValues[tagName]?.[attrName] ?? {};

export const updateTagStatsForFile = async (
  rootPath: string,
  filePath: string,
  xml: string,
): Promise<TagUsageStats> => {
  const stats = await loadTagStats(rootPath);
  const relativePath = toRelativePath(rootPath, filePath);
  const fileCounts = countUsageInXml(xml);
  const merged = mergeFileCountsIntoProject(stats, relativePath, fileCounts);
  await saveTagStats(rootPath, merged);
  return merged;
};

export const clearTagStatsCache = () => {
  cachedStats = null;
  cachedRootPath = null;
};
