import { handleMessage } from './messaging';
import { isEbthUrl } from './extraction';
import {
  CAPTURE_SETTLE_MS,
  CaptureCanceledError,
  CaptureSessionMutex,
  QUOTA_FRIENDLY_MESSAGE,
  SerializedScreenshotCapture,
  delay,
  isCaptureQuotaError,
  scrollPositions,
  segmentGroups,
} from './capture';
import { saveCapture, settings } from './storage';
import type { CapturePayload, ExtractedEbthListing, ScreenshotPart } from './types';

type ActiveCapture = { tabId?: number; canceled: boolean };

let active: ActiveCapture | undefined;
const sessions = new CaptureSessionMutex();
const screenshots = new SerializedScreenshotCapture((windowId) =>
  chrome.tabs.captureVisibleTab(windowId, { format: 'png' }),
);
const send = (tabId: number, message: unknown) => chrome.tabs.sendMessage(tabId, message);
const progress = (current: number, total: number) =>
  chrome.runtime.sendMessage({ type: 'CAPTURE_PROGRESS', current, total });

async function api(action: string, payload: Record<string, unknown>) {
  const cfg = await settings();
  if (!cfg.apiUrl) return undefined;
  const response = await fetch(cfg.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload }),
  });
  if (!response.ok) throw new Error('Backend unavailable');
  const json = await response.json() as { data?: unknown; result?: unknown };
  return json.data ?? json.result ?? json;
}

async function run() {
  if (!sessions.tryAcquire()) throw new Error('A page capture is already running.');
  const capture: ActiveCapture = { canceled: false };
  active = capture;
  let prepared = false;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id || !tab.url || !isEbthUrl(tab.url)) throw new Error('This does not appear to be an EBTH auction page.');
    capture.tabId = tab.id;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const initial = await send(tab.id, { type: 'PREPARE' }) as { loginPage: boolean };
    prepared = true;
    if (initial.loginPage) throw new Error('Sign in to EBTH in this tab, return to the auction page, and try again.');

    const cfg = await settings();
    const scrolled = await send(tab.id, {
      type: 'SCROLL',
      options: { delay: cfg.scrollDelayMs, max: cfg.maxScrollAttempts },
    }) as {
      listings: ExtractedEbthListing[];
      height: number;
      width: number;
      dpr: number;
      viewportHeight: number;
      canceled: boolean;
      attempts: number;
    };
    if (scrolled.canceled || capture.canceled) throw new CaptureCanceledError();

    const positions = scrollPositions(scrolled.height, scrolled.viewportHeight, 80, 80);
    const parts: ScreenshotPart[] = [];
    const warnings: string[] = [];
    let quotaLimited = false;

    for (let i = 0; i < positions.length; i++) {
      if (capture.canceled) throw new CaptureCanceledError();
      progress(i + 1, positions.length);
      const viewport = await send(tab.id, { type: 'POSITION', y: positions[i] }) as { width: number; height: number };
      await delay(CAPTURE_SETTLE_MS);
      try {
        const dataUrl = await screenshots.captureVisibleTab(
          tab.windowId!,
          () => capture.canceled,
          () => { quotaLimited = true; },
        );
        parts.push({ index: i, dataUrl, width: viewport.width, height: viewport.height });
      } catch (error) {
        if (error instanceof CaptureCanceledError) throw error;
        if (!parts.length) {
          if (isCaptureQuotaError(error)) throw new Error(QUOTA_FRIENDLY_MESSAGE);
          throw error;
        }
        warnings.push(isCaptureQuotaError(error)
          ? QUOTA_FRIENDLY_MESSAGE
          : 'A later page section could not be captured. BidLens kept the screenshot sections already completed.');
        break;
      }
    }

    if (quotaLimited && !warnings.includes(QUOTA_FRIENDLY_MESSAGE)) warnings.push(QUOTA_FRIENDLY_MESSAGE);
    const groups = segmentGroups(scrolled.height);
    if (groups.length > 1 || positions.length >= 80) warnings.push('The page was too tall for one image, so BidLens created multiple screenshot sections.');
    if (!scrolled.listings.length) warnings.push('No auction listings were detected. Scroll the page manually, confirm the listings are visible, and try again.');

    let sessionId: string | undefined;
    try {
      const session = await api('createSession', { sourceUrl: tab.url, mode: 'extension' }) as { sessionId?: string } | undefined;
      sessionId = session?.sessionId;
      if (sessionId) {
        await api('saveProducts', { products: scrolled.listings.map((listing) => ({
          productId: listing.id, sessionId, title: listing.title || '', listingUrl: listing.listingUrl || '',
          imageUrl: listing.imageUrl || '', currentBidCents: listing.currentBidCents || 0,
          timeRemaining: listing.timeRemaining || listing.endingText || '', brand: '', category: listing.categoryText || '',
          model: '', condition: 'Unknown', identificationConfidence: 0,
          extractionConfidence: listing.extractionConfidence, selected: true, userConfirmed: false,
          researchSelected: false, notes: listing.extractionWarnings.join(' '),
        })) });
      }
    } catch {
      warnings.push('The page was captured locally. Live synchronization requires the configured backend to be running.');
    }

    const payload: CapturePayload = {
      captureId: crypto.randomUUID(), sourceUrl: tab.url, pageTitle: tab.title || '', capturedAt: new Date().toISOString(),
      status: warnings.length ? 'partial' : 'success', width: scrolled.width, height: scrolled.height,
      devicePixelRatio: scrolled.dpr, screenshotParts: parts, warnings, listings: scrolled.listings, sessionId,
    };
    const token = await saveCapture(payload);
    try {
      if (sessionId) await api('saveCapture', { capture: {
        captureId: payload.captureId, sessionId, createdAt: payload.capturedAt, sourceUrl: payload.sourceUrl,
        pageTitle: payload.pageTitle, status: payload.status, screenshotStorageType: 'extension_local',
        screenshotPartCount: parts.length, pageWidth: payload.width, pageHeight: payload.height,
        devicePixelRatio: payload.devicePixelRatio, listingCount: payload.listings.length,
        warnings: warnings.join(' '), extensionVersion: '0.3.0',
      } });
    } catch {
      warnings.push('Capture metadata stayed local because the configured backend is not running.');
    }
    await open(token);
    return { ok: true, token, payload };
  } finally {
    if (prepared && capture.tabId) await send(capture.tabId, { type: 'RESTORE' }).catch(() => undefined);
    if (active === capture) active = undefined;
    sessions.release();
  }
}

async function open(token: string) {
  const cfg = await settings(), stored = await chrome.storage.local.get(token), payload = stored[token];
  if (!payload) throw new Error('Capture is no longer available.');
  const url = new URL(cfg.appUrl);
  url.searchParams.set('captureToken', token);
  const tab = await chrome.tabs.create({ url: url.href });
  if (!tab.id) return;
  const listener = (id: number, change: { status?: string }) => {
    if (id === tab.id && change.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.scripting.executeScript({
        target: { tabId: id },
        func: (captureToken: string, capturePayload: unknown, origin: string) => {
          if (location.origin === origin) window.postMessage({ type: 'BIDLENS_EXTENSION_CAPTURE', token: captureToken, payload: capturePayload }, origin);
        },
        args: [token, payload, url.origin],
      }).then(() => chrome.storage.local.remove(token));
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, respond) => handleMessage(message, {
  start: run,
  cancel: () => {
    if (active) {
      active.canceled = true;
      if (active.tabId) send(active.tabId, { type: 'CANCEL' }).catch(() => undefined);
    }
  },
  open,
}, respond));
