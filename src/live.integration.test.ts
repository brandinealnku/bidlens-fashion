import { expect, it } from 'vitest';
import { captureAuction } from './api';

const liveUrl = process.env.BIDLENS_LIVE_TEST_URL;
it.skipIf(!liveUrl)('optionally captures an explicitly supplied public EBTH page', async () => {
  const result = await captureAuction(liveUrl!);
  expect(result.capture.sourceUrl).toContain('ebth.com');
  expect(['success', 'partial']).toContain(result.capture.status);
}, 30_000);
