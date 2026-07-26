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
  await db.resellerProfile.upsert({where:{userId:DEMO_USER.id},update:{},create:{userId:DEMO_USER.id,preferredBrands:'["Maison Aurelia","Ridge Heritage"]',preferredCategories:'["HANDBAG","JACKET"]'}});
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
  const histories=[{id:'handbag',hammer:18000,premium:3240,tax:1593,inbound:1800,sale:62000,fees:8060,payment:1860,outbound:1800,profit:25447,roi:10398,days:32,marketplace:'eBay'},{id:'shoes',hammer:14000,premium:2520,tax:1239,inbound:2400,sale:20500,fees:3075,payment:615,outbound:2200,profit:-5549,roi:-2752,days:91,marketplace:'Poshmark'}];
  for(const h of histories){await db.auctionOutcome.upsert({where:{id:`outcome-${h.id}`},update:{},create:{id:`outcome-${h.id}`,userId:DEMO_USER.id,auctionListingId:h.id,outcome:'WON',finalHammerPrice:h.hammer,finalBuyerPremium:h.premium,finalTax:h.tax,finalInboundShipping:h.inbound,finalPickupCost:0,authenticationCost:0,cleaningCost:0,repairCost:0,otherCost:0,acquiredAt:new Date(Date.now()-h.days*86400000)}});await db.resaleOutcome.upsert({where:{id:`resale-${h.id}`},update:{},create:{id:`resale-${h.id}`,userId:DEMO_USER.id,auctionListingId:h.id,marketplace:h.marketplace,listedAt:new Date(Date.now()-(h.days-5)*86400000),soldAt:new Date(),listingPrice:h.sale,salePrice:h.sale,marketplaceFees:h.fees,paymentFees:h.payment,promotionalFees:0,shippingChargedToBuyer:0,outboundShippingCost:h.outbound,packagingCost:300,refundAmount:0,otherCosts:0,netRealizedProfit:h.profit,realizedROI:h.roi,daysToSell:h.days,predictionErrorAmount:h.sale-(opportunities.find(x=>x.id===h.id)?.resale??0)*100,predictionErrorPercent:0}});await db.inventoryItem.upsert({where:{auctionListingId:h.id},update:{},create:{userId:DEMO_USER.id,auctionListingId:h.id,status:'SOLD',purchasePriceCents:h.hammer,buyerPremiumCents:h.premium,taxCents:h.tax,inboundShippingCents:h.inbound,intendedResaleMarketplace:h.marketplace,listingDate:new Date(Date.now()-(h.days-5)*86400000),askingPriceCents:h.sale,acceptedOfferCents:h.sale,saleDate:new Date(),marketplaceFeeCents:h.fees,paymentFeeCents:h.payment,outboundShippingCents:h.outbound,actualProfitCents:h.profit,actualRoiBasisPoints:h.roi}})}
}
main().finally(() => db.$disconnect());
