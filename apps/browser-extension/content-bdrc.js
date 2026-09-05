/**
 * Parse a BDRC etext volume id from library.bdrc.io reader URLs.
 *
 * The etext reader URL looks like:
 *   /show/bdr:IE4CZ5369?scope=bdr:IE4CZ5369&openEtext=bdr:VE4CZ5369_I1KG9127&startChar=1&back=bdr:MW4CZ5369
 *
 * We only name the volume (`openEtext=bdr:VE…` or `…UT…`); Grognard resolves it to
 * the paginated `UT…_0000` transcription and fetches text + metadata itself.
 * No page text is read here.
 */

const parseBdrcPage = () => {
  try {
    const url = new URL(location.href);
    if (!/(^|\.)bdrc\.io$/i.test(url.hostname)) return null;

    const openEtext = url.searchParams.get('openEtext');
    const m = String(openEtext || '').match(/(?:bdr:)?((?:VE|UT)[0-9A-Za-z_]+)/i);
    if (!m) return null;

    return { etext_id: m[1], scope: 'volume', url: url.href };
  } catch {
    return null;
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'grognard-bdrc-page-info') return;
  const parsed = parseBdrcPage();
  if (!parsed) {
    sendResponse({
      ok: false,
      reason: 'Open a BDRC etext (the reader URL carries openEtext=bdr:VE…).',
    });
    return;
  }
  sendResponse({ ok: true, ...parsed });
});
