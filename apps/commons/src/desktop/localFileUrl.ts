/** Maps an absolute filesystem path to a URL served by Electron's crcao:// protocol. */
export const toLocalFileUrl = (absolutePath: string): string =>
  `crcao://${encodeURIComponent(absolutePath)}`;
