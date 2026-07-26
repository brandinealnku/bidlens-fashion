import { describe, it, expect } from 'vitest';
import {
  DemoListingProvider,
  EbthPermittedFetchProvider,
} from '../../lib/auction-providers';
import { DemoComparableProvider } from '../../lib/comparable-providers';
import { MockProductAnalysisProvider } from '../../lib/ai';
describe('credential-free flow', () => {
  it('imports, analyzes and finds clearly labeled demo comps', async () => {
    const listing = await new DemoListingProvider().fetchListing({
      url: 'demo://handbag',
    });
    const analysis = await new MockProductAnalysisProvider().analyzeListing({
      ...listing,
      images: [],
    });
    const comps = await new DemoComparableProvider().search({
      query: analysis.analysis.searchQueries[0],
      category: 'HANDBAG',
      currency: 'USD',
    });
    expect(analysis.analysis.candidates).toHaveLength(1);
    expect(comps.some((x) => x.status === 'ACTIVE_LISTING')).toBe(true);
  });
  it('fails permitted retrieval safely', async () =>
    await expect(
      new EbthPermittedFetchProvider().fetchListing({
        url: 'https://ebth.com/items/1',
      }),
    ).rejects.toThrow('Upload screenshots'));
});
