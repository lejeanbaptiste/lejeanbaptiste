const HOST = 'org.lejeanbaptiste.import';
const statusEl = document.getElementById('status');
const explainer = document.getElementById('explainer');
const dontShow = document.getElementById('dont-show');

const setStatus = (text) => {
  statusEl.textContent = text;
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
  if (!tab?.id) {
    setStatus('No active tab.');
    return;
  }
  let info;
  try {
    info = await chrome.tabs.sendMessage(tab.id, { type: 'ljb-page-info' });
  } catch {
    setStatus('Open a Wikisource page (reload after installing the extension).');
    return;
  }
  if (!info?.ok) {
    setStatus(info?.reason || 'This page cannot be imported.');
    return;
  }
  const order = {
    v: 1,
    action: 'import-wikisource',
    wiki: info.wiki,
    title: info.title,
    url: info.url,
    scope: info.scope,
  };
  setStatus('Contacting LJB…');
  chrome.runtime.sendNativeMessage(HOST, order, (response) => {
    if (chrome.runtime.lastError) {
      setStatus('LJB is not running (start the desktop app and try again).');
      return;
    }
    if (response?.error === 'LJB_NOT_RUNNING') {
      setStatus('LJB is not running. Start it with a project open.');
      return;
    }
    if (response?.ok) {
      setStatus('Sent to LJB. Confirm the import in the app.');
      return;
    }
    setStatus(response?.error || 'LJB did not accept the import.');
  });
});
