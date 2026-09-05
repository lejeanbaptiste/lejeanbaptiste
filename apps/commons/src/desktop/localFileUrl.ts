export const GROGNARD_PREFIX = 'grognard://';

// Chromium parses `grognard:` as a "special" scheme (registerSchemesAsPrivileged sets
// standard:true), so its host goes through domain/IDNA parsing. Cramming the whole
// percent-encoded path into the host (old `grognard://${encodeURIComponent(path)}` shape)
// makes that parsing fail whenever the decoded path contains "/" or " " — which is
// every absolute path — and dynamic import() of such a URL throws "Failed to resolve
// module specifier" instead of loading. Keep a fixed host and put the path in
// pathname segments instead, where those characters are unrestricted.
const GROGNARD_HOST = 'local/';

/** Maps an absolute filesystem path to a URL served by Electron's grognard:// protocol. */
export const toLocalFileUrl = (absolutePath: string): string => {
  const segments = absolutePath.split(/[\\/]+/).filter(Boolean);
  return `${GROGNARD_PREFIX}${GROGNARD_HOST}${segments.map(encodeURIComponent).join('/')}`;
};

export const isLocalFileUrl = (url: string): boolean => url.startsWith(GROGNARD_PREFIX);

export const fromLocalFileUrl = (url: string): string | null => {
  if (!isLocalFileUrl(url)) return null;
  try {
    const rest = url.slice(GROGNARD_PREFIX.length + GROGNARD_HOST.length);
    if (!rest) return null;
    const segments = rest.split('/').map(decodeURIComponent);
    const isWindowsDrive = /^[A-Za-z]:$/.test(segments[0]);
    return isWindowsDrive ? segments.join('\\') : `/${segments.join('/')}`;
  } catch {
    return null;
  }
};
