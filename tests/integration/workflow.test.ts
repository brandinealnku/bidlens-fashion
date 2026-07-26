import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../../lib/db/client';
import { DEMO_USER } from '../../lib/auth/current-user';
import * as flow from '../../lib/services/workflow';
let listingId = '';
describe.sequential('database-backed demo vertical slice', () => {
  it('creates and updates an owned draft', async () => {
    const listing = await flow.createListing({
      title: 'Integration leather satchel',
      description: 'Test listing',
      category: 'HANDBAG',
      currentBid: 10000,
      currency: 'USD',
      buyerPremiumType: 'PERCENT',
      buyerPremiumValue: 1800,
      taxRate: 750,
      inboundShippingCost: 1500,
      pickupCost: 0,
      conditionText: 'Good',
    });
    listingId = listing.id;
    await flow.updateListing(listingId, {
      description: 'Updated test listing',
    });
    expect((await flow.getListing(listingId))?.description).toBe(
      'Updated test listing',
    );
  });
  it('persists image, analysis and one selected candidate', async () => {
    await db.listingImage.create({
      data: {
        auctionListingId: listingId,
        storagePath: `${DEMO_USER.id}/integration.jpg`,
        displayOrder: 0,
        imageType: 'image/jpeg',
        isPrimary: true,
      },
    });
    const state = await flow.runAnalysis(listingId);
    expect(state?.analyses[0].candidates).toHaveLength(3);
    const candidate = state?.analyses[0].candidates[0];
    if (!candidate) throw new Error('Candidate missing');
    const selected = await flow.selectCandidate(listingId, candidate.id);
    expect(
      selected?.analyses[0].candidates.filter((x) => x.isSelected),
    ).toHaveLength(1);
  });
  it('loads, adds, excludes and values comparables', async () => {
    await flow.loadDemoComparables(listingId);
    await flow.addComparable(listingId, {
      marketplace: 'User research',
      comparableStatus: 'SOLD_USER_REPORTED',
      title: 'Manual sold satchel',
      price: 61000,
      shippingPrice: 1500,
      currency: 'USD',
      condition: 'GOOD',
    });
    let state = await flow.getListing(listingId);
    expect(state?.comparables.length).toBe(6);
    const comp = state?.comparables[0];
    if (!comp) throw new Error('Comparable missing');
    await flow.setComparableIncluded(
      listingId,
      comp.id,
      false,
      'Condition mismatch',
    );
    const valuation = await flow.recalculateValuation(listingId);
    expect(valuation.expectedResaleValue).toBeGreaterThan(0);
  });
  it('saves costs, recommendation, watchlist and alerts', async () => {
    await flow.updateAssumptions(listingId, {
      taxHammer: true,
      taxPremium: true,
      authentication: 3500,
      cleaning: 2000,
      repair: 0,
      otherAcquisition: 0,
      sellingFeeBps: 1300,
      paymentFeeBps: 300,
      promotional: 0,
      outbound: 1800,
      packaging: 300,
      returnRiskBps: 500,
      otherSelling: 0,
      minimumProfit: 10000,
      minimumRoiBps: 3000,
      bidIncrement: 500,
    });
    const bid = await flow.recalculateBidRecommendation(listingId);
    await flow.saveToWatchlist(listingId, { alertEnabled: true });
    const changed = await flow.updateCurrentBid(
      listingId,
      bid.maximumRecommendedHammerBid + 500,
    );
    expect(changed.recommendation).toBe('PASS');
    expect(
      await db.alert.count({ where: { auctionListingId: listingId } }),
    ).toBeGreaterThan(0);
  });
  it('records purchase, resale and prediction comparison', async () => {
    await flow.recordAuctionOutcome(listingId, {
      outcome: 'WON',
      finalHammerPrice: 10000,
      finalBuyerPremium: 1800,
      finalTax: 885,
      finalInboundShipping: 1500,
      finalPickupCost: 0,
      authenticationCost: 3500,
      cleaningCost: 2000,
      repairCost: 0,
      otherCost: 0,
      acquiredAt: '2026-01-01',
    });
    const resale = await flow.recordResaleOutcome(listingId, {
      marketplace: 'eBay',
      listedAt: '2026-01-10',
      soldAt: '2026-01-31',
      listingPrice: 65000,
      salePrice: 62000,
      marketplaceFees: 8060,
      paymentFees: 1860,
      promotionalFees: 0,
      shippingChargedToBuyer: 0,
      outboundShippingCost: 1800,
      packagingCost: 300,
      refundAmount: 0,
      otherCosts: 0,
      returned: false,
    });
    expect(resale.daysToSell).toBe(21);
    expect(resale.netRealizedProfit).not.toBeNull();
    expect(resale.predictionErrorAmount).not.toBeNull();
  });
  it('persists settings and rejects foreign ownership', async () => {
    await flow.updateSettings({ minimumRequiredProfit: 12345 });
    expect((await flow.getSettings()).minimumRequiredProfit).toBe(12345);
    const foreign = await db.userProfile.create({
      data: { email: `foreign-${Date.now()}@example.test` },
    });
    const listing = await db.auctionListing.create({
      data: {
        userId: foreign.id,
        title: 'Foreign',
        category: 'HANDBAG',
        currentBid: 0,
        buyerPremiumValue: 0,
        taxRate: 0,
        ingestionMethod: 'MANUAL',
        ingestionStatus: 'DRAFT',
      },
    });
    await expect(flow.getListing(listing.id)).rejects.toThrow('access denied');
    await db.userProfile.delete({ where: { id: foreign.id } });
  });
});
afterAll(async () => {
  if (listingId)
    await db.auctionListing.deleteMany({ where: { id: listingId } });
  await db.$disconnect();
});
