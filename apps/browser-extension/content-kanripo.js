/** Parse Kanripo work id / juan loc from kanripo.org URLs (hash, path, or query). */
const KR_LOC_RE = /^(KR[a-z0-9]+)(?:_(\d+))?$/i;

const parseLoc = (raw) => {
  const cleaned = decodeURIComponent(String(raw || '').trim()).replace(/^#+/, '');
  const match = cleaned.match(KR_LOC_RE);
  if (!match) return null;
  const kr_id = match[1];
  const juanRaw = match[2];
  if (!juanRaw) {
    return { kr_id, scope: 'work', loc: kr_id };
  }
  const juan = juanRaw.padStart(3, '0');
  return {
    kr_id,
    juan,
    loc: `${kr_id}_${juan}`,
    scope: 'juan',
  };
};

const parseKanripoPage = () => {
  try {
    const url = new URL(location.href);
    if (!/(^|\.)kanripo\.org$/i.test(url.hostname)) return null;

    if (url.hash) {
      const fromHash = parseLoc(url.hash.slice(1));
      if (fromHash) return { ...fromHash, url: url.href };
    }

    const segments = url.pathname.split('/').filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const fromPath = parseLoc(segments[i]);
      if (fromPath) return { ...fromPath, url: url.href };
    }

    for (const key of ['loc', 'id', 'kr']) {
      const value = url.searchParams.get(key);
      if (!value) continue;
      const fromQuery = parseLoc(value);
      if (fromQuery) return { ...fromQuery, url: url.href };
    }

    return null;
  } catch {
    return null;
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'grognard-kanripo-page-info') return;
  const parsed = parseKanripoPage();
  if (!parsed) {
    sendResponse({
      ok: false,
      reason: 'Open a Kanripo text first (URL hash like #KR1a0030_001).',
    });
    return;
  }
  sendResponse({ ok: true, ...parsed });
});
