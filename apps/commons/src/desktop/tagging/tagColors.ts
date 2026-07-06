import { joinProjectPath } from '@src/desktop/projectFile';

export const TAG_COLORS_RELATIVE_PATH = 'schema/tag-colors.json';
export const TAG_COLORS_CSS_RELATIVE_PATH = 'schema/tag-colors.css';

export interface TagColorEntry {
  highlight?: string;
  text?: string;
}

export interface TagColorsFile {
  version: 1;
  tags: Record<string, TagColorEntry>;
}

const DEFAULT_TAG_COLORS: Record<string, TagColorEntry> = {
  persName: { highlight: '#e8f4fc', text: '#1a5276' },
  placeName: { highlight: '#eafaf1', text: '#186a3b' },
  date: { highlight: '#fef9e7', text: '#7d6608' },
  orgName: { highlight: '#f4ecf7', text: '#512e5f' },
  title: { highlight: '#fdebd0', text: '#784212' },
};

export const emptyTagColorsFile = (): TagColorsFile => ({
  version: 1,
  tags: {},
});

export const getTagColorsPath = (rootPath: string) =>
  joinProjectPath(rootPath, TAG_COLORS_RELATIVE_PATH);

export const getTagColorsCssPath = (rootPath: string) =>
  joinProjectPath(rootPath, TAG_COLORS_CSS_RELATIVE_PATH);

export const getDefaultTagColor = (tagName: string): TagColorEntry | undefined =>
  DEFAULT_TAG_COLORS[tagName];

export const resolveTagColor = (
  file: TagColorsFile,
  tagName: string,
): TagColorEntry | undefined => file.tags[tagName] ?? getDefaultTagColor(tagName);

export const generateTagColorsCss = (file: TagColorsFile): string => {
  const mergedTags = { ...DEFAULT_TAG_COLORS, ...file.tags };
  const lines = [
    '/* Generated from schema/tag-colors.json — do not edit by hand */',
  ];

  for (const [tagName, colors] of Object.entries(mergedTags)) {
    if (!colors.highlight && !colors.text) continue;
    const selector = `*[_tag='${tagName}'], *[_tag='${tagName}'] *`;
    const rules: string[] = [];
    if (colors.highlight) rules.push(`background-color: ${colors.highlight}`);
    if (colors.text) rules.push(`color: ${colors.text} !important`);
    lines.push(`${selector} { ${rules.join('; ')}; }`);
  }

  return `${lines.join('\n')}\n`;
};

export const loadTagColors = async (rootPath: string): Promise<TagColorsFile> => {
  if (!window.electronAPI?.readFile) return emptyTagColorsFile();

  const colorsPath = getTagColorsPath(rootPath);
  try {
    if (window.electronAPI.pathExists && !(await window.electronAPI.pathExists(colorsPath))) {
      return emptyTagColorsFile();
    }
    const raw = await window.electronAPI.readFile(colorsPath);
    const parsed = JSON.parse(raw) as TagColorsFile;
    return { version: 1, tags: parsed.tags ?? {} };
  } catch {
    return emptyTagColorsFile();
  }
};

export const saveTagColors = async (rootPath: string, file: TagColorsFile): Promise<void> => {
  if (!window.electronAPI?.writeFile) return;
  await window.electronAPI.writeFile(getTagColorsPath(rootPath), JSON.stringify(file, null, 2));
};

export const saveGeneratedTagColorsCss = async (
  rootPath: string,
  css: string,
): Promise<void> => {
  if (!window.electronAPI?.writeFile) return;
  await window.electronAPI.writeFile(getTagColorsCssPath(rootPath), css);
};

const tagColorsCssCache = new Map<string, string>();

export const reapplyCachedTagColors = (rootPath: string): boolean => {
  const css = tagColorsCssCache.get(rootPath);
  if (!css) return false;
  return injectTagColorsCss(css);
};

export const injectTagColorsCss = (css: string): boolean => {
  const doc = window.writer?.editor?.getDoc();
  if (!doc) return false;

  let style = doc.getElementById('tagColors') as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = 'tagColors';
    style.type = 'text/css';
    doc.head.appendChild(style);
  }
  style.textContent = css;
  return true;
};

const cacheAndInjectTagColors = (rootPath: string, css: string): void => {
  tagColorsCssCache.set(rootPath, css);
  injectTagColorsCss(css);
};

export const scheduleTagColorsInjection = (rootPath: string): void => {
  void loadAndInjectTagColors(rootPath).then(() => {
    if (reapplyCachedTagColors(rootPath)) return;

    let attempts = 0;
    const retry = () => {
      if (reapplyCachedTagColors(rootPath) || attempts >= 20) return;
      attempts += 1;
      window.setTimeout(retry, 100);
    };
    retry();
  });
};

const tagColorsWriteQueues = new Map<string, Promise<unknown>>();

/** Serialize read-modify-write so rapid colour changes cannot drop other tag entries. */
const enqueueTagColorsWrite = <T>(
  rootPath: string,
  write: () => Promise<T>,
): Promise<T> => {
  const prior = tagColorsWriteQueues.get(rootPath) ?? Promise.resolve();
  const next = prior.then(write, write);
  tagColorsWriteQueues.set(rootPath, next);
  return next;
};

const applyTagColorUpdate = (
  file: TagColorsFile,
  tagName: string,
  colors: TagColorEntry | null,
): TagColorsFile => {
  const nextTags = { ...file.tags };
  if (!colors || (!colors.highlight && !colors.text)) {
    delete nextTags[tagName];
  } else {
    nextTags[tagName] = colors;
  }
  return { version: 1, tags: nextTags };
};

const persistTagColors = async (rootPath: string, file: TagColorsFile): Promise<TagColorsFile> => {
  await saveTagColors(rootPath, file);
  const css = generateTagColorsCss(file);
  cacheAndInjectTagColors(rootPath, css);
  await saveGeneratedTagColorsCss(rootPath, css);
  return file;
};

export const loadAndInjectTagColors = async (rootPath: string): Promise<TagColorsFile> => {
  const file = await loadTagColors(rootPath);
  const css = generateTagColorsCss(file);
  cacheAndInjectTagColors(rootPath, css);
  return file;
};

export const updateTagColor = async (
  rootPath: string,
  tagName: string,
  colors: TagColorEntry | null,
): Promise<TagColorsFile> =>
  enqueueTagColorsWrite(rootPath, async () => {
    const file = await loadTagColors(rootPath);
    return persistTagColors(rootPath, applyTagColorUpdate(file, tagName, colors));
  });
