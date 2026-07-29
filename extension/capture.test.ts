import { describe, expect, it, vi } from 'vitest';
import {
  CaptureCanceledError,
  CaptureSessionMutex,
  SerializedScreenshotCapture,
  scrollPositions,
  segmentGroups,
} from './capture';

describe('capture calculations', () => {
  it('caps positions and overlaps', () => {
    const positions = scrollPositions(100000, 800, 80, 80);
    expect(positions.length).toBe(80);
    expect(positions[1]).toBe(720);
  });

  it('handles empty and tall pages', () => {
    expect(scrollPositions(0, 800)).toEqual([]);
    expect(segmentGroups(65000)).toEqual([
      { start: 0, height: 30000 },
      { start: 30000, height: 30000 },
      { start: 60000, height: 5000 },
    ]);
  });
});

describe('serialized screenshot capture', () => {
  it('serializes captures so they never overlap', async () => {
    let concurrent = 0, maximum = 0;
    const releases: Array<() => void> = [];
    const capture = vi.fn(async () => {
      concurrent++;
      maximum = Math.max(maximum, concurrent);
      await new Promise<void>((resolve) => releases.push(resolve));
      concurrent--;
      return 'image';
    });
    const screenshots = new SerializedScreenshotCapture(capture, { intervalMs: 0 });
    const first = screenshots.captureVisibleTab(1);
    const second = screenshots.captureVisibleTab(1);
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    releases.shift()!();
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    releases.shift()!();
    await Promise.all([first, second]);
    expect(maximum).toBe(1);
  });

  it('separates calls by the configured delay after completion', async () => {
    let time = 0;
    const starts: number[] = [];
    const capture = vi.fn(async () => { starts.push(time); time += 20; return 'image'; });
    const sleep = vi.fn(async (milliseconds: number) => { time += milliseconds; });
    const screenshots = new SerializedScreenshotCapture(capture, { intervalMs: 750, now: () => time, sleep });
    await screenshots.captureVisibleTab(1);
    await screenshots.captureVisibleTab(1);
    expect(starts).toEqual([0, 770]);
    expect(sleep).toHaveBeenCalledWith(750);
  });

  it('waits and retries quota errors exactly once', async () => {
    let time = 0;
    const quota = new Error('This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota.');
    const capture = vi.fn().mockRejectedValue(quota);
    const sleep = vi.fn(async (milliseconds: number) => { time += milliseconds; });
    const onQuota = vi.fn();
    const screenshots = new SerializedScreenshotCapture(capture, { now: () => time, sleep });
    await expect(screenshots.captureVisibleTab(1, () => false, onQuota)).rejects.toBe(quota);
    expect(capture).toHaveBeenCalledTimes(2);
    expect(onQuota).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(1100);
  });

  it('rejects duplicate capture sessions', () => {
    const sessions = new CaptureSessionMutex();
    expect(sessions.tryAcquire()).toBe(true);
    expect(sessions.tryAcquire()).toBe(false);
    sessions.release();
    expect(sessions.tryAcquire()).toBe(true);
  });

  it('preserves cancellation while a queued capture waits', async () => {
    let canceled = false;
    const capture = vi.fn(async () => 'image');
    const screenshots = new SerializedScreenshotCapture(capture, { intervalMs: 0 });
    await screenshots.captureVisibleTab(1);
    canceled = true;
    await expect(screenshots.captureVisibleTab(1, () => canceled)).rejects.toBeInstanceOf(CaptureCanceledError);
    expect(capture).toHaveBeenCalledTimes(1);
  });
});
