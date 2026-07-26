export type ComparableSearchQuery = {
  query: string;
  category: string;
  currency: string;
  limit?: number;
};
export type ComparableResult = {
  externalId: string;
  title: string;
  price: number;
  shipping: number;
  status: 'ACTIVE_LISTING' | 'SOLD_USER_REPORTED' | 'SOLD_VERIFIED';
  sourceUrl: string;
  retrievedAt: Date;
};
export interface ComparableSearchProvider {
  search(q: ComparableSearchQuery): Promise<ComparableResult[]>;
}
export class ManualComparableProvider implements ComparableSearchProvider {
  async search(_query: ComparableSearchQuery): Promise<ComparableResult[]> {
    void _query;
    return [];
  }
}
export class DemoComparableProvider implements ComparableSearchProvider {
  async search(q: ComparableSearchQuery) {
    return [520, 575, 625, 680, 745].map((price, i) => ({
      externalId: `demo-${q.query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)}-${i}`,
      title: `${q.query} comparable ${i + 1}`,
      price: price * 100,
      shipping: 1800,
      status: (i < 3
        ? 'SOLD_USER_REPORTED'
        : 'ACTIVE_LISTING') as ComparableResult['status'],
      sourceUrl: '#demo',
      retrievedAt: new Date(),
    }));
  }
}
export class EbayBrowseComparableProvider implements ComparableSearchProvider {
  async search(q: ComparableSearchQuery) {
    if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET)
      throw new Error(
        'eBay credentials are not configured. Demo comparable data is being shown.',
      );
    const token = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`,
    ).toString('base64');
    const auth = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    });
    if (!auth.ok) throw new Error('eBay authorization failed');
    const { access_token } = (await auth.json()) as { access_token: string };
    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q.query)}&limit=${Math.min(q.limit ?? 20, 50)}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'X-EBAY-C-MARKETPLACE-ID':
            process.env.EBAY_MARKETPLACE_ID ?? 'EBAY_US',
        },
      },
    );
    if (!res.ok) throw new Error('eBay active-listing search failed');
    const body = (await res.json()) as {
      itemSummaries?: Array<{
        itemId: string;
        title: string;
        itemWebUrl: string;
        price: { value: string };
        shippingOptions?: Array<{ shippingCost?: { value: string } }>;
      }>;
    };
    return (body.itemSummaries ?? []).map((x) => ({
      externalId: x.itemId,
      title: x.title,
      price: Math.round(Number(x.price.value) * 100),
      shipping: Math.round(
        Number(x.shippingOptions?.[0]?.shippingCost?.value ?? 0) * 100,
      ),
      status: 'ACTIVE_LISTING' as const,
      sourceUrl: x.itemWebUrl,
      retrievedAt: new Date(),
    }));
  }
}
