import { db } from '@/lib/db/client';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { providerRows } from '@/lib/bulk/providers';
import { scannerMarketRank } from '@/lib/bulk/ranking';
import {
  createListing,
  loadDemoComparables,
  recalculateBidRecommendation,
  runAnalysis,
} from './workflow';

async function ownedBatch(id: string) {
  const user = await requireCurrentUser();
  const batch = await db.scannerBatch.findFirst({
    where: { id, userId: user.id },
  });
  if (!batch) throw new Error('Scanner batch not found or access denied');
  return { user, batch };
}
export async function createScannerBatch(input: {
  name?: string;
  provider: string;
  payload?: string;
}) {
  const user = await requireCurrentUser(),
    rows = providerRows(input.provider, input.payload);
  return db.scannerBatch.create({
    data: {
      userId: user.id,
      name: input.name?.trim() || `${input.provider} scanner batch`,
      provider: input.provider,
      totalCount: rows.length,
      listings: {
        create: rows.map((row) => ({
          rowNumber: row.rowNumber,
          sourceTitle: row.value?.title ?? `Invalid row ${row.rowNumber}`,
          sourceUrl: row.value?.sourceUrl,
          sourceMarketplace: row.value?.sourceMarketplace ?? input.provider,
          rawPayload: JSON.stringify(row.value ?? {}),
          status: row.error ? 'FAILED' : 'PENDING',
          errorMessage: row.error,
        })),
      },
    },
    include: { listings: true },
  });
}
export async function listScannerBatches() {
  const user = await requireCurrentUser();
  return db.scannerBatch.findMany({
    where: { userId: user.id },
    include: {
      listings: {
        include: {
          listing: {
            include: {
              analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
              recommendations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: [{ marketRankScore: 'desc' }, { rowNumber: 'asc' }],
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
export async function getScannerBatch(id: string) {
  await ownedBatch(id);

  return db.scannerBatch.findUnique({
    where: { id },
    include: {
      listings: {
        include: {
          listing: {
            include: {
              analyses: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              valuations: {
                orderBy: { calculatedAt: 'desc' },
                take: 1,
              },
              recommendations: {
                orderBy: { calculatedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ marketRankScore: 'desc' }, { rowNumber: 'asc' }],
      },
    },
  });
}
export async function analyzeScannerBatch(id: string) {
  const { batch } = await ownedBatch(id);
  await db.scannerBatch.update({
    where: { id },
    data: { status: 'ANALYZING' },
  });
  const rows = await db.scannerListing.findMany({
    where: { scannerBatchId: id, status: 'PENDING' },
    orderBy: { rowNumber: 'asc' },
  });
  for (const row of rows) {
    try {
      const value = JSON.parse(row.rawPayload) as {
        title: string;
        description: string;
        category: string;
        currentBidCents: number;
        sourceUrl?: string;
        auctionEndAt?: string;
      };
      const listing = await createListing({
        title: value.title,
        description: value.description,
        category: value.category,
        currentBid: value.currentBidCents,
        sourceUrl: value.sourceUrl,
        buyerPremiumType: 'PERCENT',
        buyerPremiumValue: 1800,
        taxRate: 750,
        inboundShippingCost: 0,
        pickupCost: 0,
        auctionEndAt: value.auctionEndAt,
      });
      await runAnalysis(listing.id);
      await loadDemoComparables(listing.id);
      const recommendation = await recalculateBidRecommendation(listing.id);
      const full = await db.auctionListing.findUnique({
        where: { id: listing.id },
        include: {
          analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
          valuations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
        },
      });
      const max = recommendation.maximumRecommendedHammerBid;
      const rank = scannerMarketRank({
        opportunityScore: recommendation.opportunityScore,
        confidenceBasisPoints: Math.round(
          (full?.analyses[0]?.identificationConfidence ?? 0) * 10000,
        ),
        headroomCents: max - listing.currentBid,
        maximumBidCents: max,
        comparableCount: full?.valuations[0]?.comparableCount ?? 0,
      });
      await db.scannerListing.update({
        where: { id: row.id },
        data: {
          auctionListingId: listing.id,
          status: 'ANALYZED',
          marketRankScore: rank,
          analyzedAt: new Date(),
        },
      });
    } catch (error) {
      await db.scannerListing.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          errorMessage:
            error instanceof Error ? error.message : 'Analysis failed',
        },
      });
    }
  }
  const [analyzedCount, failedCount] = await Promise.all([
    db.scannerListing.count({
      where: { scannerBatchId: id, status: 'ANALYZED' },
    }),
    db.scannerListing.count({
      where: { scannerBatchId: id, status: 'FAILED' },
    }),
  ]);
  await db.scannerBatch.update({
    where: { id },
    data: {
      status:
        failedCount && analyzedCount
          ? 'PARTIAL'
          : failedCount
            ? 'FAILED'
            : 'COMPLETE',
      analyzedCount,
      failedCount,
    },
  });
  return getScannerBatch(batch.id);
}
