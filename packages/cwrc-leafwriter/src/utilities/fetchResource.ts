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
