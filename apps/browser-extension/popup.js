const HOST = 'org.grognard.import';
const statusEl = document.getElementById('status');
const explainer = document.getElementById('explainer');
const dontShow = document.getElementById('dont-show');
const introEl = document.getElementById('intro');

const setStatus = (text) => {
  statusEl.textContent = text;
};

const siteKind = (href) => {
  try {
    const url = new URL(href);
    if (/(^|\.)wikisource\.org$/i.test(url.hostname)) return 'wikisource';
    if (/(^|\.)kanripo\.org$/i.test(url.hostname)) return 'kanripo';
    if (/(^|\.)bdrc\.io$/i.test(url.hostname)) return 'bdrc';
  } catch {
    // ignore
  }
  return null;
};

const introFor = (kind) => {
  if (kind === 'kanripo') {
    return 'Import this Kanripo work or juan into Grognard. A juan URL (e.g. #KR1a0030_001) imports one 卷; a work id alone imports the full GitHub edition.';
  }
  if (kind === 'bdrc') {
    return 'Import this BDRC etext volume into Grognard. One import pulls the whole volume, with a page break per folio.';
  }
  return 'Import this Wikisource page into Grognard. A chapter sends one file; a work root sends every chapter or juan.';
};

const explainerFor = (kind) => {
  if (kind === 'kanripo') {
    return 'Grognard must be running with a project open. The extension only names the KR id and juan; Grognard fetches text and metadata. Confirm scope in the import dialog.';
  }
  if (kind === 'bdrc') {
    return 'Grognard must be running with a project open. The extension only names the etext volume; Grognard fetches text and metadata from the BDRC Public Data Interface. Confirm in the import dialog.';
  }
  return 'Grognard must be running with a project open. The extension only names the page; Grognard fetches text and Wikidata metadata. If several editions exist, Grognard asks which tree to import.';
};

chrome.storage.local.get(['hideExplainer'], (stored) => {
  if (!stored.hideExplainer) explainer.classList.remove('hidden');
});

dontShow.addEventListener('change', () => {
  chrome.storage.local.set({ hideExplainer: dontShow.checked });
});

document.getElementById('help').addEventListener('click', () => {
  explainer.classList.toggle('hidden');
});

document.getElementById('import').addEventListener('click', async () => {
  setStatus('Checking page…');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    setStatus('No active tab.');
    return;
  }
  const kind = siteKind(tab.url);
  if (!kind) {
    setStatus('Open a Wikisource, Kanripo, or BDRC page first.');
    return;
  }

  const messageType =
    kind === 'kanripo'
      ? 'grognard-kanripo-page-info'
      : kind === 'bdrc'
        ? 'grognard-bdrc-page-info'
        : 'grognard-page-info';
  let info;
  try {
    info = await chrome.tabs.sendMessage(tab.id, { type: messageType });
  } catch {
    setStatus(`Open a ${kind} page (reload after installing the extension).`);
    return;
  }
  if (!info?.ok) {
    setStatus(info?.reason || 'This page cannot be imported.');
    return;
  }

  let order;
  if (kind === 'kanripo') {
    order = {
      v: 1,
      action: 'import-kanripo',
      kr_id: info.kr_id,
      juan: info.juan,
      loc: info.loc,
      scope: info.scope,
      url: info.url,
    };
  } else if (kind === 'bdrc') {
    order = {
      v: 1,
      action: 'import-bdrc',
      etext_id: info.etext_id,
      scope: info.scope,
      url: info.url,
    };
  } else {
    order = {
      v: 1,
      action: 'import-wikisource',
      wiki: info.wiki,
      title: info.title,
      url: info.url,
      scope: info.scope,
    };
  }

  setStatus('Contacting Grognard…');
  chrome.runtime.sendNativeMessage(HOST, order, (response) => {
    if (chrome.runtime.lastError) {
      setStatus('Grognard is not running (start the desktop app and try again).');
      return;
    }
    if (response?.error === 'GROGNARD_NOT_RUNNING') {
      setStatus('Grognard is not running. Start it with a project open.');
      return;
    }
    if (response?.ok) {
      setStatus('Sent to Grognard. Confirm the import in the app.');
      return;
    }
    setStatus(response?.error || 'Grognard did not accept the import.');
  });
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const kind = tab?.url ? siteKind(tab.url) : null;
  introEl.textContent = introFor(kind);
  explainer.querySelector('p').textContent = explainerFor(kind);
});
