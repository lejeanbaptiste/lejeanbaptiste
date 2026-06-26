export const CRCAO_PREFIX = 'crcao://';

/** Maps an absolute filesystem path to a URL served by Electron's crcao:// protocol. */
export const toLocalFileUrl = (absolutePath: string): string =>
  `${CRCAO_PREFIX}${encodeURIComponent(absolutePath)}`;

export const isLocalFileUrl = (url: string): boolean => url.startsWith(CRCAO_PREFIX);

export const fromLocalFileUrl = (url: string): string | null => {
  if (!isLocalFileUrl(url)) return null;
  try {
    return decodeURIComponent(url.slice(CRCAO_PREFIX.length));
  } catch {
    return null;
  }
};
