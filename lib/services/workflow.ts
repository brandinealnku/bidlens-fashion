import { db } from '@/lib/db/client';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { audit } from './audit';
import {
  listingInput,
  assumptionsInput,
  comparableInput,
  settingsInput,
} from './schemas';
import { MockProductAnalysisProvider } from '@/lib/ai';
import { DemoComparableProvider } from '@/lib/comparable-providers';
import { similarity, dataQuality, recommendation } from '@/lib/scoring';
import { valueComparables } from '@/lib/valuation';
import { acquisition, calculateFinance } from '@/lib/finance';

async function ownedListing(id: string) {
  const user = await requireCurrentUser();
  const listing = await db.auctionListing.findFirst({
    where: { id, userId: user.id },
    include: { assumptions: true },
  });
  if (!listing) throw new Error('Listing not found or access denied');
  return { user, listing };
}
async function invalidate(listingId: string) {
  await db.valuation.deleteMany({ where: { auctionListingId: listingId } });
}
export async function createListing(raw: unknown) {
  const user = await requireCurrentUser();
  const input = listingInput.parse(raw);
  const settings = await db.userSettings.findUnique({
    where: { userId: user.id },
  });
  const listing = await db.auctionListing.create({
    data: {
      ...input,
      userId: user.id,
      sourcePlatform: 'EBTH',
      ingestionMethod: 'MANUAL',
      ingestionStatus: 'DRAFT',
      assumptions: {
        create: {
          taxHammer: true,
          taxPremium: true,
          authentication: settings?.defaultAuthenticationAllowance ?? 0,
          cleaning: settings?.defaultCleaningAllowance ?? 0,
          repair: settings?.defaultRepairAllowance ?? 0,
          sellingFeeBps: settings?.defaultSellingFeePercent ?? 1300,
          paymentFeeBps: settings?.defaultPaymentFeePercent ?? 300,
          outbound: settings?.defaultOutboundShipping ?? 0,
          packaging: settings?.defaultPackagingCost ?? 0,
          returnRiskBps: settings?.defaultReturnRiskPercent ?? 500,
          minimumProfit: settings?.minimumRequiredProfit ?? 10000,
          minimumRoiBps: settings?.minimumRequiredROI ?? 3000,
        },
      },
    },
  });
  await audit(user.id, 'LISTING_CREATED', 'AuctionListing', listing.id);
  return listing;
}
export async function updateListing(id: string, raw: unknown) {
  const { user } = await ownedListing(id);
  const input = listingInput.partial().parse(raw);
  const listing = await db.auctionListing.update({
    where: { id },
    data: input,
  });
  await invalidate(id);
  await audit(user.id, 'LISTING_UPDATED', 'AuctionListing', id, {
    fields: Object.keys(input),
  });
  return listing;
}
export async function getListing(id: string) {
  await ownedListing(id);
  return db.auctionListing.findUnique({
    where: { id },
    include: {
      images: { orderBy: { displayOrder: 'asc' } },
      analyses: {
        orderBy: { createdAt: 'desc' },
        include: { candidates: true },
        take: 1,
      },
      comparables: true,
      valuations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      recommendations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      watchlist: true,
      outcomes: true,
      resales: true,
      alerts: { where: { status: 'UNREAD' } },
      assumptions: true,
      scenarios: true,
    },
  });
}
export async function listUserListings() {
  const user = await requireCurrentUser();
  return db.auctionListing.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  });
}
export async function deleteDraftListing(id: string) {
  const { user, listing } = await ownedListing(id);
  if (listing.ingestionStatus !== 'DRAFT')
    throw new Error('Only drafts can be deleted');
  await db.auctionListing.delete({ where: { id } });
  await audit(user.id, 'LISTING_DELETED', 'AuctionListing', id);
}
export async function runAnalysis(id: string) {
  const { user, listing } = await ownedListing(id);
  const running = await db.productAnalysis.create({
    data: {
      auctionListingId: id,
      provider: 'MOCK',
      providerModel: 'demo-v1',
      status: 'RUNNING',
      rawStructuredResult: '{}',
      category: 'UNSUPPORTED',
      color: '[]',
      material: '[]',
      conditionGrade: 'UNKNOWN',
      identificationConfidence: 0,
      authenticityRiskLevel: 'INSUFFICIENT_EVIDENCE',
      visibleDamage: '[]',
      includedItems: '[]',
      evidence: '[]',
      conflictingEvidence: '[]',
      searchQueries: '[]',
    },
  });
  try {
    const result = await new MockProductAnalysisProvider().analyzeListing({
      title: listing.title,
      description: listing.description,
      images: [],
    });
    const a = result.analysis;
    await db.productAnalysis.update({
      where: { id: running.id },
      data: {
        status: 'SUCCEEDED',
        rawStructuredResult: result.raw,
        category: a.category,
        brand: a.brand,
        suspectedModel: a.suspectedModel,
        productLine: a.productLine,
        styleNumber: a.styleNumber,
        serialOrDateCode: a.serialOrDateCode,
        color: JSON.stringify(a.color),
        material: JSON.stringify(a.material),
        size: a.size,
        dimensions: JSON.stringify(a.dimensions),
        estimatedEra: a.estimatedEra,
        genderMarket: a.genderMarket,
        conditionGrade: a.conditionGrade,
        identificationConfidence: a.identificationConfidence,
        authenticityRiskLevel: a.authenticityRiskLevel,
        authenticityConfidence: a.authenticityConfidence,
        visibleDamage: JSON.stringify(a.visibleDamage),
        includedItems: JSON.stringify(a.includedItems),
        evidence: JSON.stringify(a.evidence),
        conflictingEvidence: JSON.stringify(a.conflictingEvidence),
        searchQueries: JSON.stringify(a.searchQueries),
        candidates: {
          create: a.candidates.map((c, rank) => ({
            rank: rank + 1,
            brand: c.brand,
            model: c.model,
            productLine: c.productLine,
            category: c.category,
            color: JSON.stringify(c.color),
            material: JSON.stringify(c.material),
            size: c.size,
            estimatedEra: c.estimatedEra,
            confidence: c.confidence,
            evidence: JSON.stringify(c.evidence),
            conflictingEvidence: JSON.stringify(c.conflictingEvidence),
            searchQueries: JSON.stringify(c.searchQueries),
          })),
        },
      },
    });
    await invalidate(id);
    await audit(user.id, 'ANALYSIS_RUN', 'ProductAnalysis', running.id);
    return getListing(id);
  } catch (error) {
    await db.productAnalysis.update({
      where: { id: running.id },
      data: {
        status: 'FAILED',
        rawStructuredResult: JSON.stringify({
          error: error instanceof Error ? error.message : 'Analysis failed',
        }),
      },
    });
    throw error;
  }
}
export async function selectCandidate(
  listingId: string,
  candidateId: string | null,
) {
  const { user } = await ownedListing(listingId);
  const analysis = await db.productAnalysis.findFirst({
    where: { auctionListingId: listingId, status: 'SUCCEEDED' },
    orderBy: { createdAt: 'desc' },
    include: { candidates: true },
  });
  if (!analysis) throw new Error('Analysis not found');
  const chosen = candidateId
    ? analysis.candidates.find((c) => c.id === candidateId)
    : undefined;
  if (candidateId && !chosen) throw new Error('Candidate not found');
  await db.$transaction([
    db.productCandidate.updateMany({
      where: { productAnalysisId: analysis.id },
      data: { isSelected: false },
    }),
    ...(chosen
      ? [
          db.productCandidate.update({
            where: { id: chosen.id },
            data: { isSelected: true },
          }),
          db.productAnalysis.update({
            where: { id: analysis.id },
            data: {
              brand: chosen.brand,
              suspectedModel: chosen.model,
              productLine: chosen.productLine,
              category: chosen.category,
              color: chosen.color,
              material: chosen.material,
              size: chosen.size,
              estimatedEra: chosen.estimatedEra,
            },
          }),
        ]
      : []),
    ...(!chosen
      ? [
          db.productAnalysis.update({
            where: { id: analysis.id },
            data: {
              brand: null,
              suspectedModel: null,
              productLine: null,
              identificationConfidence: 0,
            },
          }),
        ]
      : []),
    db.valuation.deleteMany({ where: { auctionListingId: listingId } }),
  ]);
  if (chosen) {
    const target = {
      brand: chosen.brand ?? undefined,
      model: chosen.model ?? undefined,
      productLine: chosen.productLine ?? undefined,
      category: chosen.category,
      color: JSON.parse(chosen.color) as string[],
      material: JSON.parse(chosen.material) as string[],
      size: chosen.size ?? undefined,
    };
    const comparables = await db.comparable.findMany({
      where: { auctionListingId: listingId, userId: user.id },
    });
    await Promise.all(
      comparables.map((comparable) =>
        db.comparable.update({
          where: { id: comparable.id },
          data: {
            similarityScore: similarity(target, {
              brand: target.brand,
              model: target.model,
              productLine: target.productLine,
              category: target.category,
              material: comparable.material ? [comparable.material] : undefined,
              color: comparable.color ? [comparable.color] : undefined,
              size: comparable.size ?? undefined,
              condition: comparable.condition ?? undefined,
            }).score,
          },
        }),
      ),
    );
  }
  await audit(user.id, 'CANDIDATE_SELECTED', 'ProductAnalysis', analysis.id, {
    candidateId,
  });
  if (
    (await db.comparable.count({ where: { auctionListingId: listingId } })) > 0
  )
    await recalculateValuation(listingId);
  return getListing(listingId);
}
function identityOf(a: {
  brand: string | null;
  suspectedModel: string | null;
  productLine: string | null;
  category: string;
  color: string;
  material: string;
  size: string | null;
  conditionGrade: string;
}) {
  return {
    brand: a.brand ?? undefined,
    model: a.suspectedModel ?? undefined,
    productLine: a.productLine ?? undefined,
    category: a.category,
    color: JSON.parse(a.color),
    material: JSON.parse(a.material),
    size: a.size ?? undefined,
    condition: a.conditionGrade,
  };
}
export async function loadDemoComparables(listingId: string) {
  const { user } = await ownedListing(listingId);
  const analysis = await db.productAnalysis.findFirst({
    where: { auctionListingId: listingId, status: 'SUCCEEDED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!analysis) throw new Error('Run analysis first');
  const target = identityOf(analysis);
  const query =
    (JSON.parse(analysis.searchQueries) as string[])[0] ??
    [analysis.brand, analysis.suspectedModel].filter(Boolean).join(' ');
  const results = await new DemoComparableProvider().search({
    query,
    category: analysis.category,
    currency: 'USD',
  });
  for (const result of results) {
    const ident = { ...target, condition: 'GOOD' };
    const sim = similarity(target, ident).score;
    const quality = dataQuality({
      status: result.status,
      identity: true,
      condition: 'GOOD',
      date: result.retrievedAt,
      price: result.price,
      shipping: result.shipping,
      sourceUrl: result.sourceUrl,
      provider: 'DEMO',
    });
    await db.comparable.upsert({
      where: {
        provider_externalId: {
          provider: 'DEMO',
          externalId: result.externalId,
        },
      },
      update: {
        price: result.price,
        shippingPrice: result.shipping,
        totalPrice: result.price + result.shipping,
        similarityScore: sim,
        dataQualityScore: quality,
      },
      create: {
        userId: user.id,
        auctionListingId: listingId,
        provider: 'DEMO',
        externalId: result.externalId,
        sourceUrl: result.sourceUrl,
        title: result.title,
        marketplace: 'Demo marketplace',
        comparableStatus: result.status,
        evidenceType: 'DEMO_DATA',
        price: result.price,
        shippingPrice: result.shipping,
        currency: 'USD',
        totalPrice: result.price + result.shipping,
        condition: 'GOOD',
        similarityScore: sim,
        dataQualityScore: quality,
        rawSourceData: JSON.stringify({
          demo: true,
          retrievedAt: result.retrievedAt,
        }),
      },
    });
  }
  await invalidate(listingId);
  await audit(user.id, 'COMPARABLES_LOADED', 'AuctionListing', listingId, {
    count: results.length,
  });
  await recalculateValuation(listingId);
  return getListing(listingId);
}
export async function addComparable(listingId: string, raw: unknown) {
  const { user } = await ownedListing(listingId);
  const input = comparableInput.parse(raw);
  const analysis = await db.productAnalysis.findFirst({
    where: { auctionListingId: listingId, status: 'SUCCEEDED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!analysis) throw new Error('Run analysis first');
  const target = identityOf(analysis);
  const comp = {
    brand: target.brand,
    model: target.model,
    productLine: target.productLine,
    category: target.category,
    material: input.material ? [input.material] : undefined,
    color: input.color ? [input.color] : undefined,
    size: input.size ?? undefined,
    condition: input.condition ?? undefined,
  };
  const sim = similarity(target, comp).score,
    quality = dataQuality({
      status: input.comparableStatus,
      identity: true,
      condition: input.condition ?? undefined,
      date: input.soldOrListedAt ?? undefined,
      price: input.price,
      shipping: input.shippingPrice,
      sourceUrl: input.sourceUrl ?? undefined,
      provider: 'MANUAL',
      evidenceType: input.comparableStatus.startsWith('SOLD') ? 'COMPLETED_SALE' : input.comparableStatus === 'ACTIVE_LISTING' ? 'ACTIVE_LISTING' : 'APPRAISAL_REFERENCE',
    });
  const record = await db.comparable.create({
    data: {
      ...input,
      userId: user.id,
      auctionListingId: listingId,
      provider: 'MANUAL',
      totalPrice: input.price + input.shippingPrice,
      similarityScore: sim,
      dataQualityScore: quality,
    },
  });
  await invalidate(listingId);
  await audit(user.id, 'COMPARABLE_ADDED', 'Comparable', record.id);
  await recalculateValuation(listingId);
  return record;
}
export async function setComparableIncluded(
  listingId: string,
  comparableId: string,
  included: boolean,
  reason?: string,
) {
  const { user } = await ownedListing(listingId);
  const found = await db.comparable.findFirst({
    where: { id: comparableId, auctionListingId: listingId, userId: user.id },
  });
  if (!found) throw new Error('Comparable not found');
  await db.comparable.update({
    where: { id: comparableId },
    data: {
      userIncluded: included,
      exclusionReason: included ? null : (reason ?? 'User excluded'),
    },
  });
  await invalidate(listingId);
  await audit(
    user.id,
    included ? 'COMPARABLE_INCLUDED' : 'COMPARABLE_EXCLUDED',
    'Comparable',
    comparableId,
  );
  return recalculateValuation(listingId);
}
export async function recalculateValuation(listingId: string) {
  const { user } = await ownedListing(listingId);
  const comps = await db.comparable.findMany({
    where: { auctionListingId: listingId, userId: user.id },
  });
  const result = valueComparables(
    comps.map((c) => ({
      id: `${c.provider}:${c.externalId ?? c.id}`,
      price: c.price,
      shipping: c.shippingPrice,
      status: c.comparableStatus as
        | 'SOLD_VERIFIED'
        | 'SOLD_USER_REPORTED'
        | 'ACTIVE_LISTING'
        | 'ESTIMATED'
        | 'UNKNOWN',
      similarity: c.similarityScore,
      quality: c.dataQualityScore,
      date: c.soldOrListedAt ?? undefined,
      condition: c.condition ?? 'UNKNOWN',
      included: c.userIncluded,
    })),
  );
  const valuation = await db.valuation.create({
    data: {
      auctionListingId: listingId,
      methodVersion: 'demo-v1',
      quickSaleEstimate: result.quick,
      expectedResaleValue: result.expected,
      optimisticResaleValue: result.optimistic,
      lowEstimate: result.low,
      highEstimate: result.high,
      valuationConfidence: result.confidence,
      comparableCount: result.count,
      verifiedSoldComparableCount: result.sold,
      activeComparableCount: result.active,
      rationale: JSON.stringify(result.rationale),
    },
  });
  await audit(user.id, 'VALUATION_RECALCULATED', 'Valuation', valuation.id);
  if (
    (await db.listingFinancialAssumptions.count({
      where: { auctionListingId: listingId },
    })) > 0
  )
    await recalculateBidRecommendation(listingId);
  return valuation;
}
export async function updateAssumptions(listingId: string, raw: unknown) {
  const { user } = await ownedListing(listingId);
  const input = assumptionsInput.parse(raw);
  const value = await db.listingFinancialAssumptions.upsert({
    where: { auctionListingId: listingId },
    update: input,
    create: { auctionListingId: listingId, ...input },
  });
  await db.bidRecommendation.deleteMany({
    where: { auctionListingId: listingId },
  });
  await audit(
    user.id,
    'COSTS_UPDATED',
    'ListingFinancialAssumptions',
    value.id,
  );
  if (
    (await db.valuation.count({ where: { auctionListingId: listingId } })) > 0
  )
    await recalculateBidRecommendation(listingId);
  return value;
}
export async function recalculateBidRecommendation(listingId: string) {
  const { user, listing } = await ownedListing(listingId);
  const valuation = await db.valuation.findFirst({
    where: { auctionListingId: listingId },
    orderBy: { calculatedAt: 'desc' },
  });
  if (!valuation) throw new Error('Calculate valuation first');
  const a = listing.assumptions;
  if (!a) throw new Error('Financial assumptions are missing');
  const f = calculateFinance({
    hammer: listing.currentBid,
    premium: {
      type: listing.buyerPremiumType as 'PERCENT' | 'FIXED',
      value: listing.buyerPremiumValue,
    },
    taxBps: listing.taxRate,
    taxHammer: a.taxHammer,
    taxPremium: a.taxPremium,
    inbound: listing.inboundShippingCost,
    pickup: listing.pickupCost,
    authentication: a.authentication,
    cleaning: a.cleaning,
    repair: a.repair,
    otherAcquisition: a.otherAcquisition,
    resale: valuation.expectedResaleValue,
    sellingFeeBps: a.sellingFeeBps,
    paymentFeeBps: a.paymentFeeBps,
    promotional: a.promotional,
    outbound: a.outbound,
    packaging: a.packaging,
    returnRiskBps: a.returnRiskBps,
    otherSelling: a.otherSelling,
    minimumProfit: a.minimumProfit,
    minimumRoiBps: a.minimumRoiBps,
    bidIncrement: a.bidIncrement,
  });
  const analysis = await db.productAnalysis.findFirst({
    where: { auctionListingId: listingId, status: 'SUCCEEDED' },
    orderBy: { createdAt: 'desc' },
  });
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.min(1, Math.max(0, f.profit / a.minimumProfit)) * 25 +
          Math.min(1, Math.max(0, (f.roiBps ?? 0) / a.minimumRoiBps)) * 20 +
          (analysis?.identificationConfidence ?? 0) * 15 +
          (valuation.valuationConfidence / 100) * 15 +
          10 +
          5 +
          5 +
          5,
      ),
    ),
  );
  const warnings: string[] = [];
  if (valuation.comparableCount < 3)
    warnings.push('Limited comparable evidence');
  if (analysis?.authenticityRiskLevel === 'HIGH')
    warnings.push('High authenticity risk');
  if (listing.currentBid > f.maxHammer)
    warnings.push('Current bid is above maximum');
  const rec = recommendation({
    score,
    profit: f.profit,
    roiBps: f.roiBps,
    minProfit: a.minimumProfit,
    minRoiBps: a.minimumRoiBps,
    currentBid: listing.currentBid,
    maxBid: f.maxHammer,
    confidence: analysis?.identificationConfidence ?? 0,
    critical:
      analysis?.authenticityRiskLevel === 'HIGH' ||
      listing.category === 'UNSUPPORTED',
    limited: valuation.comparableCount < 3,
  });
  const acq = acquisition({
    hammer: listing.currentBid,
    premium: {
      type: listing.buyerPremiumType as 'PERCENT' | 'FIXED',
      value: listing.buyerPremiumValue,
    },
    taxBps: listing.taxRate,
    taxHammer: a.taxHammer,
    taxPremium: a.taxPremium,
    inbound: listing.inboundShippingCost,
    pickup: listing.pickupCost,
    authentication: a.authentication,
    cleaning: a.cleaning,
    repair: a.repair,
    otherAcquisition: a.otherAcquisition,
    resale: valuation.expectedResaleValue,
    sellingFeeBps: a.sellingFeeBps,
    paymentFeeBps: a.paymentFeeBps,
    promotional: a.promotional,
    outbound: a.outbound,
    packaging: a.packaging,
    returnRiskBps: a.returnRiskBps,
    otherSelling: a.otherSelling,
    minimumProfit: a.minimumProfit,
    minimumRoiBps: a.minimumRoiBps,
    bidIncrement: a.bidIncrement,
  });
  const saved = await db.bidRecommendation.create({
    data: {
      auctionListingId: listingId,
      valuationId: valuation.id,
      currentHammerBid: listing.currentBid,
      buyerPremiumAmount: acq.premium,
      salesTaxAmount: acq.tax,
      inboundShipping: listing.inboundShippingCost,
      pickupCost: listing.pickupCost,
      authenticationAllowance: a.authentication,
      cleaningAllowance: a.cleaning,
      repairAllowance: a.repair,
      otherAcquisitionCosts: a.otherAcquisition,
      expectedResaleValue: valuation.expectedResaleValue,
      sellingFees: f.selling,
      paymentFees: f.payment,
      outboundShipping: a.outbound,
      packagingCost: a.packaging,
      returnRiskReserve: f.reserve,
      otherSellingCosts: a.otherSelling,
      minimumRequiredProfit: a.minimumProfit,
      maximumAllInAcquisitionCost: f.maximumAllIn,
      maximumRecommendedHammerBid: f.maxHammer,
      expectedNetProfitAtCurrentBid: f.profit,
      expectedROIAtCurrentBid: f.roiBps,
      opportunityScore: score,
      recommendation: rec,
      warnings: JSON.stringify({ warnings, breakdown: f }),
    },
  });
  await audit(user.id, 'BID_RECALCULATED', 'BidRecommendation', saved.id);
  await evaluateAlerts(listingId, saved.id);
  return saved;
}
export async function saveToWatchlist(
  listingId: string,
  input: {
    notes?: string | null;
    alertEnabled?: boolean;
    userMaximumBid?: number | null;
    plannedBid?: number | null;
    priority?: string;
    decisionDeadline?: Date | null;
  } = {},
) {
  const { user } = await ownedListing(listingId);
  const item = await db.watchlistItem.upsert({
    where: { auctionListingId: listingId },
    update: input,
    create: { auctionListingId: listingId, userId: user.id, ...input },
  });
  await audit(user.id, 'WATCHLIST_CHANGED', 'WatchlistItem', item.id);
  return item;
}
export async function updateWatchlistPlan(listingId:string,raw:Record<string,unknown>){const priority=String(raw.priority);if(!['HIGH','MEDIUM','LOW'].includes(priority))throw new Error('Invalid priority');return saveToWatchlist(listingId,{userMaximumBid:raw.userMaximumBid==null?null:cents(raw.userMaximumBid),plannedBid:raw.plannedBid==null?null:cents(raw.plannedBid),priority,decisionDeadline:raw.decisionDeadline?new Date(String(raw.decisionDeadline)):null,notes:raw.notes?String(raw.notes):null})}
export async function removeFromWatchlist(listingId: string) {
  const { user } = await ownedListing(listingId);
  await db.watchlistItem.deleteMany({
    where: { auctionListingId: listingId, userId: user.id },
  });
  await audit(user.id, 'WATCHLIST_REMOVED', 'AuctionListing', listingId);
}
export async function updateCurrentBid(listingId: string, currentBid: number) {
  if (!Number.isInteger(currentBid) || currentBid < 0)
    throw new Error('Current bid must be non-negative integer cents');
  const { user } = await ownedListing(listingId);
  await db.auctionListing.update({
    where: { id: listingId },
    data: { currentBid, lastRefreshedAt: new Date() },
  });
  await audit(user.id, 'CURRENT_BID_UPDATED', 'AuctionListing', listingId, {
    currentBid,
  });
  return recalculateBidRecommendation(listingId);
}
async function createAlertOnce(
  userId: string,
  listingId: string,
  type: string,
  message: string,
  threshold?: number,
) {
  const exists = await db.alert.findFirst({
    where: {
      userId,
      auctionListingId: listingId,
      alertType: type,
      status: 'UNREAD',
    },
  });
  if (!exists)
    await db.alert.create({
      data: {
        userId,
        auctionListingId: listingId,
        alertType: type,
        message,
        thresholdValue: threshold,
        triggeredAt: new Date(),
      },
    });
}
export async function evaluateAlerts(
  listingId: string,
  recommendationId?: string,
) {
  const { user, listing } = await ownedListing(listingId);
  const bid = recommendationId
    ? await db.bidRecommendation.findUnique({ where: { id: recommendationId } })
    : await db.bidRecommendation.findFirst({
        where: { auctionListingId: listingId },
        orderBy: { calculatedAt: 'desc' },
      });
  if (!bid) return;
  const max = bid.maximumRecommendedHammerBid;
  if (max > 0 && listing.currentBid * 100 >= max * 80)
    await createAlertOnce(
      user.id,
      listingId,
      'BID_80_PERCENT',
      'Current bid reached 80% of the recommended maximum.',
      Math.floor(max * 0.8),
    );
  if (listing.currentBid === max)
    await createAlertOnce(
      user.id,
      listingId,
      'BID_AT_MAX',
      'Current bid reached the recommended maximum.',
      max,
    );
  if (listing.currentBid > max)
    await createAlertOnce(
      user.id,
      listingId,
      'BID_ABOVE_MAX',
      'Current bid exceeds the recommended maximum.',
      max,
    );
  if (listing.auctionEndAt) {
    const hours = (listing.auctionEndAt.getTime() - Date.now()) / 3600000;
    if (hours <= 24 && hours > 0)
      await createAlertOnce(
        user.id,
        listingId,
        'ENDS_24_HOURS',
        'Auction ends within 24 hours.',
      );
    if (hours <= 2 && hours > 0)
      await createAlertOnce(
        user.id,
        listingId,
        'ENDS_2_HOURS',
        'Auction ends within 2 hours.',
      );
  }
  const v = await db.valuation.findUnique({ where: { id: bid.valuationId } });
  if (v && v.comparableCount < 3)
    await createAlertOnce(
      user.id,
      listingId,
      'LIMITED_COMPARABLES',
      'Comparable evidence is insufficient.',
    );
}
export async function markAlertRead(alertId: string) {
  const user = await requireCurrentUser();
  const found = await db.alert.findFirst({
    where: { id: alertId, userId: user.id },
  });
  if (!found) throw new Error('Alert not found');
  return db.alert.update({
    where: { id: alertId },
    data: { status: 'READ', readAt: new Date() },
  });
}
const cents = (x: unknown) => {
  if (typeof x !== 'number' || !Number.isInteger(x) || x < 0)
    throw new Error('Money must be non-negative integer cents');
  return x;
};
export async function recordAuctionOutcome(
  listingId: string,
  raw: Record<string, unknown>,
) {
  const { user } = await ownedListing(listingId);
  const outcome = String(raw.outcome);
  if (
    !['WON', 'LOST', 'DID_NOT_BID', 'PASSED', 'AUCTION_CANCELED'].includes(
      outcome,
    )
  )
    throw new Error('Invalid outcome');
  await db.auctionOutcome.deleteMany({
    where: { auctionListingId: listingId, userId: user.id },
  });
  const record = await db.auctionOutcome.create({
    data: {
      userId: user.id,
      auctionListingId: listingId,
      outcome,
      finalHammerPrice: outcome === 'WON' ? cents(raw.finalHammerPrice) : null,
      finalBuyerPremium:
        outcome === 'WON' ? cents(raw.finalBuyerPremium) : null,
      finalTax: outcome === 'WON' ? cents(raw.finalTax) : null,
      finalInboundShipping:
        outcome === 'WON' ? cents(raw.finalInboundShipping) : null,
      finalPickupCost: outcome === 'WON' ? cents(raw.finalPickupCost) : null,
      authenticationCost:
        outcome === 'WON' ? cents(raw.authenticationCost) : null,
      cleaningCost: outcome === 'WON' ? cents(raw.cleaningCost) : null,
      repairCost: outcome === 'WON' ? cents(raw.repairCost) : null,
      otherCost: outcome === 'WON' ? cents(raw.otherCost) : null,
      acquiredAt: raw.acquiredAt ? new Date(String(raw.acquiredAt)) : null,
      notes: raw.notes ? String(raw.notes) : null,
    },
  });
  await audit(user.id, 'AUCTION_OUTCOME_RECORDED', 'AuctionOutcome', record.id);
  await db.opportunityDecision.upsert({where:{auctionListingId:listingId},create:{auctionListingId:listingId,status:outcome},update:{status:outcome}});
  if(outcome==='WON') await db.inventoryItem.upsert({where:{auctionListingId:listingId},create:{userId:user.id,auctionListingId:listingId,status:'AWAITING_PAYMENT',acquisitionDate:record.acquiredAt,purchasePriceCents:record.finalHammerPrice??0,buyerPremiumCents:record.finalBuyerPremium??0,taxCents:record.finalTax??0,inboundShippingCents:record.finalInboundShipping??0,authenticationCostCents:record.authenticationCost??0,cleaningRepairCostCents:(record.cleaningCost??0)+(record.repairCost??0),otherAcquisitionCostsCents:(record.finalPickupCost??0)+(record.otherCost??0)},update:{acquisitionDate:record.acquiredAt,purchasePriceCents:record.finalHammerPrice??0,buyerPremiumCents:record.finalBuyerPremium??0,taxCents:record.finalTax??0,inboundShippingCents:record.finalInboundShipping??0,authenticationCostCents:record.authenticationCost??0,cleaningRepairCostCents:(record.cleaningCost??0)+(record.repairCost??0),otherAcquisitionCostsCents:(record.finalPickupCost??0)+(record.otherCost??0)}});
  return record;
}
export async function recordResaleOutcome(
  listingId: string,
  raw: Record<string, unknown>,
) {
  const { user } = await ownedListing(listingId);
  const auction = await db.auctionOutcome.findFirst({
    where: { auctionListingId: listingId, userId: user.id, outcome: 'WON' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!auction) throw new Error('A won auction outcome is required');
  const fields = [
    'listingPrice',
    'salePrice',
    'marketplaceFees',
    'paymentFees',
    'promotionalFees',
    'shippingChargedToBuyer',
    'outboundShippingCost',
    'packagingCost',
    'refundAmount',
    'otherCosts',
  ] as const;
  const money = Object.fromEntries(fields.map((k) => [k, cents(raw[k])]));
  const acquisitionCost =
    (auction.finalHammerPrice ?? 0) +
    (auction.finalBuyerPremium ?? 0) +
    (auction.finalTax ?? 0) +
    (auction.finalInboundShipping ?? 0) +
    (auction.finalPickupCost ?? 0) +
    (auction.authenticationCost ?? 0) +
    (auction.cleaningCost ?? 0) +
    (auction.repairCost ?? 0) +
    (auction.otherCost ?? 0);
  const net =
    money.salePrice +
    money.shippingChargedToBuyer -
    money.marketplaceFees -
    money.paymentFees -
    money.promotionalFees -
    money.outboundShippingCost -
    money.packagingCost -
    money.refundAmount -
    money.otherCosts -
    acquisitionCost;
  const roi =
    acquisitionCost > 0 ? Math.trunc((net * 10000) / acquisitionCost) : null;
  const recommendation = await db.bidRecommendation.findFirst({
    where: { auctionListingId: listingId },
    orderBy: { calculatedAt: 'desc' },
  });
  const predictionError = recommendation
    ? money.salePrice - recommendation.expectedResaleValue
    : null;
  const soldAt = raw.soldAt ? new Date(String(raw.soldAt)) : null,
    listedAt = raw.listedAt ? new Date(String(raw.listedAt)) : null;
  await db.resaleOutcome.deleteMany({
    where: { auctionListingId: listingId, userId: user.id },
  });
  const record = await db.resaleOutcome.create({
    data: {
      userId: user.id,
      auctionListingId: listingId,
      marketplace: String(raw.marketplace),
      ...money,
      listedAt,
      soldAt,
      returned: Boolean(raw.returned),
      netRealizedProfit: net,
      realizedROI: roi,
      daysToSell:
        soldAt && listedAt
          ? Math.max(
              0,
              Math.floor((soldAt.getTime() - listedAt.getTime()) / 86400000),
            )
          : null,
      predictionErrorAmount: predictionError,
      predictionErrorPercent:
        recommendation &&
        recommendation.expectedResaleValue > 0 &&
        predictionError !== null
          ? Math.trunc(
              (predictionError * 10000) / recommendation.expectedResaleValue,
            )
          : null,
      notes: raw.notes ? String(raw.notes) : null,
    },
  });
  await audit(user.id, 'RESALE_OUTCOME_RECORDED', 'ResaleOutcome', record.id);
  await db.inventoryItem.updateMany({where:{auctionListingId:listingId,userId:user.id},data:{status:record.returned?'RETURNED':record.soldAt?'SOLD':'LISTED',intendedResaleMarketplace:record.marketplace,listingDate:record.listedAt,askingPriceCents:record.listingPrice,acceptedOfferCents:record.salePrice,saleDate:record.soldAt,marketplaceFeeCents:record.marketplaceFees??0,paymentFeeCents:record.paymentFees??0,outboundShippingCents:record.outboundShippingCost??0,refundReturnCostsCents:record.refundAmount??0,actualProfitCents:record.netRealizedProfit,actualRoiBasisPoints:record.realizedROI,actualNetProceedsCents:(record.salePrice??0)+(record.shippingChargedToBuyer??0)-(record.marketplaceFees??0)-(record.paymentFees??0)-(record.promotionalFees??0)-(record.outboundShippingCost??0)-(record.packagingCost??0)-(record.refundAmount??0)-(record.otherCosts??0)}});
  await db.opportunityDecision.upsert({where:{auctionListingId:listingId},create:{auctionListingId:listingId,status:record.soldAt?'SOLD':'LISTED_FOR_RESALE'},update:{status:record.soldAt?'SOLD':'LISTED_FOR_RESALE'}});
  return record;
}
export async function getSettings() {
  const user = await requireCurrentUser();
  return db.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
}
export async function updateSettings(raw: Record<string, unknown>) {
  const user = await requireCurrentUser();
  const data = settingsInput.partial().parse(raw);
  const record = await db.userSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });
  await audit(user.id, 'SETTINGS_CHANGED', 'UserSettings', record.id, {
    fields: Object.keys(data),
  });
  return record;
}
export async function createCustomCandidate(
  listingId: string,
  raw: Record<string, unknown>,
) {
  const { user } = await ownedListing(listingId);
  const analysis = await db.productAnalysis.findFirst({
    where: { auctionListingId: listingId, status: 'SUCCEEDED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!analysis) throw new Error('Analysis not found');
  const rank =
    (await db.productCandidate.count({
      where: { productAnalysisId: analysis.id },
    })) + 1;
  const candidate = await db.productCandidate.create({
    data: {
      productAnalysisId: analysis.id,
      rank,
      brand: raw.brand ? String(raw.brand) : null,
      model: raw.model ? String(raw.model) : null,
      productLine: raw.productLine ? String(raw.productLine) : null,
      category: String(raw.category ?? analysis.category),
      color: JSON.stringify(raw.color ?? []),
      material: JSON.stringify(raw.material ?? []),
      size: raw.size ? String(raw.size) : null,
      estimatedEra: raw.estimatedEra ? String(raw.estimatedEra) : null,
      confidence: 1,
      evidence: JSON.stringify(['User-provided identity']),
      conflictingEvidence: '[]',
      searchQueries: JSON.stringify(raw.searchQueries ?? []),
    },
  });
  await audit(
    user.id,
    'CUSTOM_CANDIDATE_CREATED',
    'ProductCandidate',
    candidate.id,
  );
  return selectCandidate(listingId, candidate.id);
}
export async function updateManualComparable(
  listingId: string,
  comparableId: string,
  raw: unknown,
) {
  const { user } = await ownedListing(listingId);
  const existing = await db.comparable.findFirst({
    where: {
      id: comparableId,
      userId: user.id,
      auctionListingId: listingId,
      provider: 'MANUAL',
    },
  });
  if (!existing) throw new Error('Editable manual comparable not found');
  const input = comparableInput.partial().parse(raw);
  const price = input.price ?? existing.price,
    shipping = input.shippingPrice ?? existing.shippingPrice;
  const updated = await db.comparable.update({
    where: { id: comparableId },
    data: { ...input, totalPrice: price + shipping },
  });
  await invalidate(listingId);
  await audit(user.id, 'COMPARABLE_UPDATED', 'Comparable', comparableId);
  await recalculateValuation(listingId);
  return updated;
}
export async function deleteManualComparable(
  listingId: string,
  comparableId: string,
) {
  const { user } = await ownedListing(listingId);
  const result = await db.comparable.deleteMany({
    where: {
      id: comparableId,
      userId: user.id,
      auctionListingId: listingId,
      provider: 'MANUAL',
    },
  });
  if (!result.count) throw new Error('Manual comparable not found');
  await invalidate(listingId);
  await audit(user.id, 'COMPARABLE_DELETED', 'Comparable', comparableId);
  await recalculateValuation(listingId);
}
export async function updateImage(
  listingId: string,
  imageId: string,
  input: { isPrimary?: boolean; displayOrder?: number },
) {
  const { user } = await ownedListing(listingId);
  const image = await db.listingImage.findFirst({
    where: { id: imageId, auctionListingId: listingId },
  });
  if (!image) throw new Error('Image not found');
  if (input.isPrimary)
    await db.listingImage.updateMany({
      where: { auctionListingId: listingId },
      data: { isPrimary: false },
    });
  const updated = await db.listingImage.update({
    where: { id: imageId },
    data: { isPrimary: input.isPrimary, displayOrder: input.displayOrder },
  });
  await audit(user.id, 'IMAGE_UPDATED', 'ListingImage', imageId, input);
  return updated;
}
export async function resetSettings() {
  return updateSettings({
    preferredCurrency: 'USD',
    defaultTaxRate: 750,
    defaultBuyerPremiumPercent: 1800,
    defaultSellingFeePercent: 1300,
    defaultPaymentFeePercent: 300,
    defaultOutboundShipping: 1800,
    defaultPackagingCost: 300,
    defaultCleaningAllowance: 2000,
    defaultRepairAllowance: 0,
    defaultAuthenticationAllowance: 3500,
    defaultReturnRiskPercent: 500,
    minimumRequiredProfit: 10000,
    minimumRequiredROI: 3000,
    buyThresholdScore: 72,
    reviewThresholdScore: 45,
    preferredMarketplaces: '["eBay"]',
    timezone: 'America/New_York',
    demoMode: true,
  });
}
