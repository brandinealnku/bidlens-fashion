import { isEbthUrl } from './extraction';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function status(text: string, error = false) {
  el('status').textContent = text;
  el('status').className = error ? 'error' : '';
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  const update = message as { type?: string; current?: number; total?: number };
  if (update.type === 'CAPTURE_PROGRESS' && update.current && update.total) {
    status(`Capturing page section ${update.current} of ${update.total}…`);
  }
});

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  el('title').textContent = tab.title || 'Untitled tab';
  el('url').textContent = tab.url || 'Unavailable';
  const ready = !!tab.url && isEbthUrl(tab.url);
  el<HTMLButtonElement>('capture').disabled = !ready;
  status(ready ? 'Ready' : 'Open an EBTH auction or followed-items page before starting capture.', !ready);
});

el('capture').addEventListener('click', () => {
  const button = el<HTMLButtonElement>('capture');
  if (button.disabled) return;
  button.disabled = true;
  el<HTMLButtonElement>('cancel').hidden = false;
  status('Reading the page and extracting visible EBTH listings…');
  chrome.runtime.sendMessage({ type: 'START_CAPTURE' }, (response: unknown) => {
    const result = response as { ok: boolean; error?: string; payload?: { listings: unknown[]; warnings: string[] } };
    el<HTMLButtonElement>('cancel').hidden = true;
    if (!result?.ok) {
      status(result?.error || 'Analysis failed', true);
      button.disabled = false;
      return;
    }
    el('count').textContent = `${result.payload?.listings.length || 0} listings detected`;
    el('warnings').textContent = result.payload?.warnings.join(' ') || '';
    status('Sent to BidLens. The BidLens tab is opening…');
  });
});

el('cancel').addEventListener('click', () =>
  chrome.runtime.sendMessage({ type: 'CANCEL_CAPTURE' }, () => status('Analysis canceled.')),
);
el('options').addEventListener('click', () =>
  chrome.tabs.create({ url: chrome.runtime.getURL?.('options.html') || 'options.html' }),
);
