import { db } from '@/lib/db/client';
import {
  evaluateCondition,
  scoreOpportunity,
  type Profile,
  type RuleCondition,
} from './intelligence';

const parse = (value: string) => {
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
};

export async function getProfile(
  userId: string,
): Promise<Profile & { strategyName: string }> {
  const profile = await db.resellerProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return {
    ...profile,
    maximumRiskLevel: profile.maximumRiskLevel as Profile['maximumRiskLevel'],
    preferredBrands: parse(profile.preferredBrands),
    excludedBrands: parse(profile.excludedBrands),
    preferredCategories: parse(profile.preferredCategories),
  };
}

export async function loadOpportunities(userId: string) {
  const [profile, listings, rules] = await Promise.all([
    getProfile(userId),
    db.auctionListing.findMany({
      where: { userId },
      include: {
        analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
        valuations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
        recommendations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
        decision: true,
        watchlist: true,
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        inventoryItem: true,
      },
      orderBy: { auctionEndAt: 'asc' },
    }),
    db.decisionRule.findMany({
      where: { userId, enabled: true },
      orderBy: { priority: 'desc' },
    }),
  ]);
  return listings
    .map((listing) => {
      const analysis = listing.analyses[0];
      const valuation = listing.valuations[0];
      const recommendation = listing.recommendations[0];
      const risk =
        analysis?.authenticityRiskLevel === 'MODERATE'
          ? 'MEDIUM'
          : analysis?.authenticityRiskLevel === 'INSUFFICIENT_EVIDENCE'
            ? 'CRITICAL'
            : (analysis?.authenticityRiskLevel ?? 'MEDIUM');
      const explanation = scoreOpportunity(
        {
          currentBidCents: listing.currentBid,
          maximumBidCents: recommendation?.maximumRecommendedHammerBid ?? 0,
          expectedProfitCents:
            recommendation?.expectedNetProfitAtCurrentBid ?? 0,
          expectedRoiBasisPoints:
            recommendation?.expectedROIAtCurrentBid ?? null,
          confidenceBasisPoints: Math.round(
            (analysis?.identificationConfidence ?? 0.5) * 10000,
          ),
          comparableCount: valuation?.comparableCount ?? 0,
          riskLevel: risk as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          brand: analysis?.brand ?? undefined,
          category: listing.category,
        },
        profile,
      );
      const facts = {
        expectedProfitCents: recommendation?.expectedNetProfitAtCurrentBid ?? 0,
        expectedRoiBasisPoints: recommendation?.expectedROIAtCurrentBid ?? 0,
        currentBidCents: listing.currentBid,
        comparableCount: valuation?.comparableCount ?? 0,
        brand: analysis?.brand ?? '',
        category: listing.category,
      };
      const triggeredRules = rules.filter((rule) =>
        (JSON.parse(rule.conditions) as RuleCondition[]).every((condition) =>
          evaluateCondition(facts, condition),
        ),
      );
      for (const rule of triggeredRules)
        if (rule.action === 'PRIORITIZE') {
          explanation.personalScore = Math.min(
            100,
            explanation.personalScore + Math.max(1, rule.priority),
          );
          explanation.positiveFactors.push(`Rule: ${rule.message}`);
        }
      const ruleStatus = triggeredRules.some((rule) => rule.action === 'PASS')
        ? 'PASSED'
        : triggeredRules.some((rule) => rule.action === 'REQUIRE_REVIEW')
          ? 'REVIEWING'
          : undefined;
      return {
        listing,
        analysis,
        valuation,
        recommendation,
        explanation,
        triggeredRules,
        status:
          ruleStatus ??
          listing.decision?.status ??
          (listing.watchlist ? 'WATCHING' : 'NEW'),
        headroom:
          (recommendation?.maximumRecommendedHammerBid ?? 0) -
          listing.currentBid,
      };
    })
    .sort((a, b) => b.explanation.personalScore - a.explanation.personalScore);
}
