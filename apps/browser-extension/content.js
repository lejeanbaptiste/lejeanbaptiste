const BLOCKED = [
  'Talk:',
  'User:',
  'Wikisource:',
  'File:',
  'Template:',
  'Help:',
  'Category:',
  'Portal:',
  'Author:',
  'Index:',
  'Page:',
  'Module:',
  '討論:',
  '作者:',
  '分類:',
];

const parseTitle = (href) => {
  try {
    const url = new URL(href);
    if (!/(^|\.)wikisource\.org$/i.test(url.hostname)) return null;
    const match =
      url.pathname.match(/^\/wiki\/(.+)$/) ||
      url.pathname.match(/^\/[a-z]{2,3}(?:-[a-zA-Z]+)?\/(.+)$/);
    if (!match) return null;
    const title = decodeURIComponent(match[1].replace(/_/g, ' '));
    return { origin: url.origin, title, url: url.href };
  } catch {
    return null;
  }
};

const rejectReason = (title) => {
  if (BLOCKED.some((prefix) => title.startsWith(prefix))) {
    return `“${title}” is not a main-namespace work or chapter.`;
  }
  return null;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'grognard-page-info') return;
  const parsed = parseTitle(location.href);
  if (!parsed) {
    sendResponse({ ok: false, reason: 'Open a Wikisource page first.' });
    return;
  }
  const reason = rejectReason(parsed.title);
  if (reason) {
    sendResponse({ ok: false, reason });
    return;
  }
  sendResponse({
    ok: true,
    wiki: parsed.origin,
    title: parsed.title,
    url: parsed.url,
    scope: parsed.title.includes('/') ? 'page' : 'work',
  });
});
