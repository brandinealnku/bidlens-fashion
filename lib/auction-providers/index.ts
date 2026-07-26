export type ListingFetchInput = {
  url?: string;
  title?: string;
  description?: string;
};
export type NormalizedAuctionListing = {
  title: string;
  description: string;
  sourceUrl?: string;
  ingestionMethod: 'MANUAL' | 'DEMO' | 'PERMITTED_FETCH';
};
export interface AuctionListingProvider {
  canHandle(url: string): boolean;
  fetchListing(input: ListingFetchInput): Promise<NormalizedAuctionListing>;
}
export class ManualListingProvider implements AuctionListingProvider {
  canHandle() {
    return true;
  }
  async fetchListing(i: ListingFetchInput) {
    if (!i.title) throw new Error('A title is required');
    return {
      title: i.title,
      description: i.description ?? '',
      sourceUrl: i.url,
      ingestionMethod: 'MANUAL' as const,
    };
  }
}
export class DemoListingProvider implements AuctionListingProvider {
  canHandle(u: string) {
    return u === 'demo://handbag';
  }
  async fetchListing(
    _input: ListingFetchInput,
  ): Promise<NormalizedAuctionListing> {
    return {
      title: 'Maison Aurelia Marais leather satchel',
      description: 'Fictional demo listing with light corner wear.',
      ingestionMethod: 'DEMO' as const,
    };
  }
}
export class EbthPermittedFetchProvider implements AuctionListingProvider {
  canHandle(u: string) {
    try {
      const x = new URL(u);
      return (
        x.protocol === 'https:' &&
        (x.hostname === 'ebth.com' || x.hostname.endsWith('.ebth.com'))
      );
    } catch {
      return false;
    }
  }
  async fetchListing(
    _input: ListingFetchInput,
  ): Promise<NormalizedAuctionListing> {
    throw new Error(
      'We could not retrieve this listing automatically. Upload screenshots or enter the details manually.',
    );
  }
}
