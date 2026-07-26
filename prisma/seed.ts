import { PrismaClient } from '@prisma/client';
import { opportunities } from '../lib/demo';
import { DEMO_USER } from '../lib/auth/current-user';
const db = new PrismaClient();
async function main() {
  await db.userProfile.upsert({
    where: { id: DEMO_USER.id },
    update: { email: DEMO_USER.email, displayName: DEMO_USER.displayName },
    create: {
      ...DEMO_USER,
      settings: { create: {} },
    },
  });
  await db.userSettings.upsert({
    where: { userId: DEMO_USER.id },
    update: {},
    create: { userId: DEMO_USER.id },
  });
  for (const x of opportunities) {
    await db.auctionListing.upsert({
      where: { id: x.id },
      update: {},
      create: {
        id: x.id,
        userId: DEMO_USER.id,
        title: `${x.brand} ${x.model}`,
        description: 'Fictional demonstration data.',
        category: x.cat.toUpperCase().replaceAll(' ', '_'),
        currentBid: x.bid * 100,
        buyerPremiumValue: 1800,
        taxRate: 750,
        ingestionMethod: 'DEMO',
        ingestionStatus: 'COMPLETE',
      },
    });
    await db.watchlistItem.upsert({
      where: { auctionListingId: x.id },
      update: {},
      create: { auctionListingId: x.id, userId: DEMO_USER.id },
    });
    await db.listingFinancialAssumptions.upsert({
      where: { auctionListingId: x.id },
      update: {},
      create: { auctionListingId: x.id },
    });
    await db.valuation.upsert({
      where: { id: `valuation-${x.id}` },
      update: {},
      create: {
        id: `valuation-${x.id}`,
        auctionListingId: x.id,
        methodVersion: 'seed-v1',
        quickSaleEstimate: Math.round(x.resale * 84),
        expectedResaleValue: x.resale * 100,
        optimisticResaleValue: Math.round(x.resale * 112),
        lowEstimate: Math.round(x.resale * 80),
        highEstimate: Math.round(x.resale * 115),
        valuationConfidence: x.confidence,
        comparableCount: x.rec === 'REVIEW' ? 2 : 5,
        verifiedSoldComparableCount: 0,
        activeComparableCount: 2,
        rationale: JSON.stringify(['Fictional seeded demonstration result']),
      },
    });
    await db.bidRecommendation.upsert({
      where: { id: `recommendation-${x.id}` },
      update: {},
      create: {
        id: `recommendation-${x.id}`,
        auctionListingId: x.id,
        valuationId: `valuation-${x.id}`,
        currentHammerBid: x.bid * 100,
        buyerPremiumAmount: Math.round(x.bid * 18),
        salesTaxAmount: 0,
        inboundShipping: 0,
        pickupCost: 0,
        authenticationAllowance: 0,
        cleaningAllowance: 0,
        repairAllowance: 0,
        otherAcquisitionCosts: 0,
        expectedResaleValue: x.resale * 100,
        sellingFees: Math.round(x.resale * 13),
        paymentFees: Math.round(x.resale * 3),
        outboundShipping: 1800,
        packagingCost: 300,
        returnRiskReserve: Math.round(x.resale * 5),
        otherSellingCosts: 0,
        minimumRequiredProfit: 10000,
        maximumAllInAcquisitionCost: x.max * 118,
        maximumRecommendedHammerBid: x.max * 100,
        expectedNetProfitAtCurrentBid: x.profit * 100,
        expectedROIAtCurrentBid: x.roi * 100,
        opportunityScore: x.rec === 'BUY' ? 82 : x.rec === 'REVIEW' ? 61 : 25,
        recommendation: x.rec,
        warnings: '[]',
      },
    });
  }
}
main().finally(() => db.$disconnect());
