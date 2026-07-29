export const CAPTURE_INTERVAL_MS = 750;
export const QUOTA_RETRY_DELAY_MS = 1_100;
export const CAPTURE_SETTLE_MS = 250;
export const QUOTA_ERROR_NAME = 'MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND';
export const QUOTA_FRIENDLY_MESSAGE = 'Chrome temporarily limited screenshot capture. BidLens slowed the capture and retried.';

export const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function isCaptureQuotaError(error: unknown) {
  return error instanceof Error && error.message.includes(QUOTA_ERROR_NAME);
}

export class CaptureCanceledError extends Error {
  constructor() {
    super('Capture canceled');
    this.name = 'CaptureCanceledError';
  }
}

/** A non-waiting mutex for whole page-capture sessions. */
export class CaptureSessionMutex {
  private locked = false;

  tryAcquire() {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  release() {
    this.locked = false;
  }
}

type ScreenshotCaptureOptions = {
  intervalMs?: number;
  quotaRetryDelayMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

/**
 * Owns every captureVisibleTab call. Calls are queued, never overlap, and are
 * spaced from the completion of the previous attempt. A Chrome quota failure
 * gets exactly one deliberately slower retry.
 */
export class SerializedScreenshotCapture {
  private queue: Promise<void> = Promise.resolve();
  private lastAttemptCompletedAt: number | undefined;
  private readonly intervalMs: number;
  private readonly quotaRetryDelayMs: number;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(private readonly capture: (windowId: number) => Promise<string>, options: ScreenshotCaptureOptions = {}) {
    this.intervalMs = options.intervalMs ?? CAPTURE_INTERVAL_MS;
    this.quotaRetryDelayMs = options.quotaRetryDelayMs ?? QUOTA_RETRY_DELAY_MS;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? delay;
  }

  captureVisibleTab(windowId: number, canceled: () => boolean = () => false, onQuota?: () => void): Promise<string> {
    const task = this.queue.then(() => this.captureWithOneQuotaRetry(windowId, canceled, onQuota));
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async captureWithOneQuotaRetry(windowId: number, canceled: () => boolean, onQuota?: () => void) {
    try {
      return await this.attempt(windowId, canceled);
    } catch (error) {
      if (!isCaptureQuotaError(error)) throw error;
      onQuota?.();
      await this.sleep(this.quotaRetryDelayMs);
      return this.attempt(windowId, canceled);
    }
  }

  private async attempt(windowId: number, canceled: () => boolean) {
    if (canceled()) throw new CaptureCanceledError();
    if (this.lastAttemptCompletedAt !== undefined) {
      await this.sleep(Math.max(0, this.intervalMs - (this.now() - this.lastAttemptCompletedAt)));
    }
    if (canceled()) throw new CaptureCanceledError();
    try {
      return await this.capture(windowId);
    } finally {
      this.lastAttemptCompletedAt = this.now();
    }
  }
}

export function scrollPositions(height: number, viewport: number, overlap = 80, max = 80) {
  const step = Math.max(1, viewport - overlap), out: number[] = [];
  for (let y = 0; y < height && out.length < max; y += step) out.push(Math.min(y, Math.max(0, height - viewport)));
  return [...new Set(out)];
}

export function segmentGroups(height: number, maxCanvasHeight = 30000) {
  const n = Math.max(1, Math.ceil(height / maxCanvasHeight));
  return Array.from({ length: n }, (_, i) => ({ start: i * maxCanvasHeight, height: Math.min(maxCanvasHeight, height - i * maxCanvasHeight) }));
}
