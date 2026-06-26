/** Load text from a remote URL or a desktop crcao:// project file. */
export async function fetchResourceText(url: string): Promise<string | null> {
  if (url.startsWith('crcao://')) {
    const electronAPI = (
      window as Window & { electronAPI?: { readFile: (path: string) => Promise<string> } }
    ).electronAPI;

    if (electronAPI?.readFile) {
      try {
        const filePath = decodeURIComponent(url.slice('crcao://'.length));
        return await electronAPI.readFile(filePath);
      } catch {
        return null;
      }
    }
  }

  const response = await fetch(url).catch(() => null);
  if (!response) return null;

  const isLocal = url.startsWith('crcao://');
  if (!isLocal && response.status !== 200) return null;

  try {
    const data = await response.text();
    return data || null;
  } catch {
    return null;
  }
}
