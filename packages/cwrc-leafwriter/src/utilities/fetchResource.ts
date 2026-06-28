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

/** Read a desktop/local RNG (with includes inlined) and return a worker-safe blob URL. */
export async function localSchemaToBlobUrl(schemaURL: string): Promise<string | null> {
  const text = await fetchResourceText(schemaURL);
  if (!text) return null;
  const merged = await mergeRngIncludes(text, schemaURL);
  return URL.createObjectURL(new Blob([merged], { type: 'application/xml' }));
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
