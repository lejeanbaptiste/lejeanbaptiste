const CRCAO_PREFIX = 'crcao://';

export const isLocalFileUrl = (url: string): boolean => url.startsWith(CRCAO_PREFIX);

export const fromLocalFileUrl = (url: string): string | null => {
  if (!isLocalFileUrl(url)) return null;
  try {
    return decodeURIComponent(url.slice(CRCAO_PREFIX.length));
  } catch {
    return null;
  }
};

const isUsableResourceUrl = (url: string): boolean => {
  if (!url) return false;
  if (isLocalFileUrl(url)) return fromLocalFileUrl(url) !== null;
  if (/^https?:\/\//i.test(url)) return true;
  if (url.startsWith('blob:')) return true;
  // Skip paths built by mistakenly treating crcao URLs as relative file paths.
  if (url.includes('crcao:')) return false;
  if (/%2F/i.test(url)) return false;
  return true;
};

export const filterResourceUrls = (urls: string[]): string[] => {
  const seen = new Set<string>();
  const filtered: string[] = [];

  for (const url of urls) {
    if (!isUsableResourceUrl(url)) continue;

    const key = fromLocalFileUrl(url) ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(url);
  }

  return filtered;
};

const resolveIncludeUrl = (baseSchemaUrl: string, href: string): string => {
  const localBase = fromLocalFileUrl(baseSchemaUrl);
  if (localBase) {
    const includeFile = href.includes('/')
      ? (href.match(/(.*\/)(.*)/)?.[2] ?? href)
      : href;
    const separator = localBase.includes('\\') ? '\\' : '/';
    const dir = localBase.slice(
      0,
      Math.max(localBase.lastIndexOf('/'), localBase.lastIndexOf('\\')),
    );
    return `${CRCAO_PREFIX}${encodeURIComponent(`${dir}${separator}${includeFile}`)}`;
  }

  if (/^https?:\/\//i.test(baseSchemaUrl)) {
    const schemaBase = baseSchemaUrl.match(/(.*\/)(.*)/)?.[1];
    const includeFile = href.includes('/')
      ? (href.match(/(.*\/)(.*)/)?.[2] ?? href)
      : href;
    return schemaBase ? schemaBase + includeFile : href;
  }

  return href;
};

const mergeRngIncludes = async (rngText: string, baseUrl: string): Promise<string> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rngText, 'application/xml');
  if (doc.querySelector('parsererror')) return rngText;

  const grammar = doc.querySelector('grammar');
  if (!grammar) return rngText;

  const includes = Array.from(grammar.children).filter(
    (el) => el.tagName.toLowerCase() === 'include',
  );

  for (const includeEl of includes) {
    const href = includeEl.getAttribute('href');
    if (!href) continue;

    const includeUrl = resolveIncludeUrl(baseUrl, href);
    const includeText = await fetchResourceText(includeUrl);
    if (!includeText) continue;

    const mergedIncludeText = await mergeRngIncludes(includeText, includeUrl);
    const includeDoc = parser.parseFromString(mergedIncludeText, 'application/xml');
    const includeGrammar = includeDoc.querySelector('grammar');
    if (!includeGrammar) continue;

    // RelaxNG override: <start>/<define> children of <include> replace the
    // matching entries in the included grammar BEFORE it's merged in. Without
    // this, an override define nested inside <include> is silently discarded
    // by includeEl.remove() below and the stock upstream define wins instead.
    for (const overrideChild of Array.from(includeEl.children)) {
      const tag = overrideChild.tagName.toLowerCase();
      if (tag === 'start') {
        const existingStart = Array.from(includeGrammar.children).find(
          (el) => el.tagName.toLowerCase() === 'start',
        );
        const imported = includeDoc.importNode(overrideChild, true);
        if (existingStart) existingStart.replaceWith(imported);
        else includeGrammar.appendChild(imported);
      } else if (tag === 'define') {
        const name = overrideChild.getAttribute('name');
        const existingDefine = name
          ? Array.from(includeGrammar.children).find(
              (el) => el.tagName.toLowerCase() === 'define' && el.getAttribute('name') === name,
            )
          : null;
        const imported = includeDoc.importNode(overrideChild, true);
        if (existingDefine) existingDefine.replaceWith(imported);
        else includeGrammar.appendChild(imported);
      }
    }

    for (const child of Array.from(includeGrammar.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'start') {
        const existing = Array.from(grammar.children).find(
          (el) => el.tagName.toLowerCase() === 'start',
        );
        if (existing) existing.replaceWith(child.cloneNode(true));
        else grammar.appendChild(child.cloneNode(true));
      } else if (tag === 'define') {
        const name = child.getAttribute('name');
        const existing = name
          ? Array.from(grammar.children).find(
              (el) => el.tagName.toLowerCase() === 'define' && el.getAttribute('name') === name,
            )
          : null;
        if (existing) existing.replaceWith(child.cloneNode(true));
        else grammar.appendChild(child.cloneNode(true));
      }
    }

    includeEl.remove();
  }

  return new XMLSerializer().serializeToString(doc);
};

const localSchemaBlobCache = new Map<string, { revision: string; url: string }>();

/** Drop cached blob URLs (e.g. after sanmiao merge or validator cache clear). */
export const clearLocalSchemaBlobCache = (): void => {
  for (const { url } of localSchemaBlobCache.values()) {
    URL.revokeObjectURL(url);
  }
  localSchemaBlobCache.clear();
};

/**
 * Read a desktop/local RNG and return a worker-safe blob URL.
 * Reuses the same blob URL while `revision` is unchanged so the validator
 * worker can skip recompiling a 1MB flat TEI grammar on every validate().
 */
export async function localSchemaToBlobUrl(
  schemaURL: string,
  revision?: string | null,
): Promise<string | null> {
  const localPath = fromLocalFileUrl(schemaURL);
  const cacheKey = localPath ?? schemaURL;
  const revisionKey = revision ?? '';

  const cached = localSchemaBlobCache.get(cacheKey);
  if (cached && cached.revision === revisionKey) {
    return cached.url;
  }

  const text = await fetchResourceText(schemaURL);
  if (!text) return null;
  // Project sanmiao schemas are pre-flattened at install time; skip runtime merge.
  const merged = /<include[\s>]/i.test(text) ? await mergeRngIncludes(text, schemaURL) : text;
  const blobUrl = URL.createObjectURL(new Blob([merged], { type: 'application/xml' }));

  if (cached?.url) {
    URL.revokeObjectURL(cached.url);
  }
  localSchemaBlobCache.set(cacheKey, { revision: revisionKey, url: blobUrl });

  return blobUrl;
}

/** Load text from a remote URL or a desktop crcao:// project file. */
export async function fetchResourceText(url: string): Promise<string | null> {
  const localPath = fromLocalFileUrl(url);
  if (localPath) {
    const electronAPI = (
      window as Window & { electronAPI?: { readFile: (path: string) => Promise<string> } }
    ).electronAPI;

    if (electronAPI?.readFile) {
      try {
        return await electronAPI.readFile(localPath);
      } catch {
        return null;
      }
    }
  }

  if (!/^https?:\/\//i.test(url) && !url.startsWith('blob:')) {
    return null;
  }

  const response = await fetch(url).catch(() => null);
  if (!response) return null;
  if (response.status !== 200) return null;

  try {
    const data = await response.text();
    return data || null;
  } catch {
    return null;
  }
}
