import { db } from '@/lib/db/client';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { WatchlistClient } from '@/components/watchlist/watchlist-client';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user = await requireCurrentUser();
  const records = await db.watchlistItem.findMany({
    where: { userId: user.id },
    include: {
      listing: {
        include: {
          recommendations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const initial = records.map((record) => ({
    id: record.id,
    listingId: record.auctionListingId,
    title: record.listing.title,
    currentBid: record.listing.currentBid,
    maxBid: record.listing.recommendations[0]?.maximumRecommendedHammerBid ?? 0,
    recommendation:
      record.listing.recommendations[0]?.recommendation ?? 'REVIEW',
  }));
  return (
    <>
      <h1>Watchlist</h1>
      <p className="muted">
        Updates are manual in demo mode. Updating a bid persists, recalculates
        the recommendation, and evaluates alerts.
      </p>
      <WatchlistClient initial={initial} />
    </>
  );
}
