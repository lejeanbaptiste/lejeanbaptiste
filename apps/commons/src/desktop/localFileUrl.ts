export const LJB_PREFIX = 'ljb://';

/** Maps an absolute filesystem path to a URL served by Electron's ljb:// protocol. */
export const toLocalFileUrl = (absolutePath: string): string =>
  `${LJB_PREFIX}${encodeURIComponent(absolutePath)}`;

export const isLocalFileUrl = (url: string): boolean => url.startsWith(LJB_PREFIX);

export const fromLocalFileUrl = (url: string): string | null => {
  if (!isLocalFileUrl(url)) return null;
  try {
    return decodeURIComponent(url.slice(LJB_PREFIX.length));
  } catch {
    return null;
  }
};
