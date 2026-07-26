export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Profile = {
  minimumProfitCents: number;
  minimumRoiBasisPoints: number;
  maximumPurchasePriceCents: number;
  maximumRiskLevel: RiskLevel;
  preferredBrands: string[];
  excludedBrands: string[];
  preferredCategories: string[];
};

export type Opportunity = {
  currentBidCents: number;
  maximumBidCents: number;
  expectedProfitCents: number;
  expectedRoiBasisPoints: number | null;
  confidenceBasisPoints: number;
  comparableCount: number;
  riskLevel: RiskLevel;
  brand?: string;
  category?: string;
};

const riskRank: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};
const norm = (value?: string) => value?.trim().toLowerCase();
const includes = (values: string[], value?: string) =>
  Boolean(value && values.map(norm).includes(norm(value)));
export const clampScore = (score: number) => Math.max(0, Math.min(100, score));
export const bidHeadroomCents = (maximumBidCents: number, currentBidCents: number) =>
  maximumBidCents - currentBidCents;

export function scoreOpportunity(item: Opportunity, profile: Profile) {
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];
  const headroom = bidHeadroomCents(item.maximumBidCents, item.currentBidCents);
  let marketScore = 50;
  if (headroom > 0) {
    marketScore += Math.min(20, Math.round((headroom / Math.max(item.maximumBidCents, 1)) * 40));
    positiveFactors.push('Current bid is below the recommended maximum.');
  } else {
    marketScore -= 30;
    negativeFactors.push('Current bid is above the recommended maximum.');
  }
  marketScore += Math.round((item.confidenceBasisPoints - 5000) / 500);
  if (item.comparableCount >= 3) {
    marketScore += 10;
    positiveFactors.push('Comparable evidence is strong.');
  } else {
    marketScore -= 15;
    negativeFactors.push('Fewer than three usable comparables are available.');
  }
  marketScore -= riskRank[item.riskLevel] * 7;
  if (riskRank[item.riskLevel] > riskRank[profile.maximumRiskLevel])
    negativeFactors.push('Risk exceeds your profile limit.');
  marketScore = clampScore(marketScore);

  let personalScore = marketScore;
  if (item.expectedProfitCents >= profile.minimumProfitCents) {
    personalScore += 10;
    positiveFactors.push('Expected profit exceeds your minimum target.');
  } else {
    personalScore -= 20;
    negativeFactors.push('Expected profit is below your minimum target.');
  }
  if ((item.expectedRoiBasisPoints ?? -1) >= profile.minimumRoiBasisPoints) personalScore += 10;
  else personalScore -= 15;
  if (item.currentBidCents > profile.maximumPurchasePriceCents) {
    personalScore -= 20;
    negativeFactors.push('The item exceeds your maximum purchase-price preference.');
  }
  if (includes(profile.preferredBrands, item.brand)) personalScore += 8;
  if (includes(profile.preferredCategories, item.category)) personalScore += 6;
  if (includes(profile.excludedBrands, item.brand)) {
    personalScore -= 50;
    negativeFactors.push('The brand is excluded by your profile.');
  }
  if (riskRank[item.riskLevel] > riskRank[profile.maximumRiskLevel]) personalScore -= 25;
  personalScore = clampScore(personalScore);
  return {
    marketScore,
    personalScore,
    positiveFactors,
    negativeFactors,
    recommendationReason: positiveFactors[0] ?? negativeFactors[0] ?? 'Review the available evidence.',
    recommendedNextAction:
      personalScore >= 75 && headroom > 0 ? 'Add to watchlist and plan a bid' : personalScore >= 45 ? 'Review assumptions' : 'Pass',
  };
}

export type RuleCondition = { field: string; operator: 'EQ'|'NEQ'|'GT'|'GTE'|'LT'|'LTE'|'IN'|'NOT_IN'|'CONTAINS'; value: unknown };
export function evaluateCondition(record: Record<string, unknown>, condition: RuleCondition) {
  const actual = record[condition.field];
  switch (condition.operator) {
    case 'EQ': return actual === condition.value;
    case 'NEQ': return actual !== condition.value;
    case 'GT': return Number(actual) > Number(condition.value);
    case 'GTE': return Number(actual) >= Number(condition.value);
    case 'LT': return Number(actual) < Number(condition.value);
    case 'LTE': return Number(actual) <= Number(condition.value);
    case 'IN': return Array.isArray(condition.value) && condition.value.includes(actual);
    case 'NOT_IN': return Array.isArray(condition.value) && !condition.value.includes(actual);
    case 'CONTAINS': return String(actual ?? '').toLowerCase().includes(String(condition.value).toLowerCase());
  }
}

export function calculateScenario(input: { resaleValueCents: number; purchasePriceCents: number; sellingFeeBasisPoints: number; shippingCents: number; cleaningRepairCents: number; authenticationCents: number; desiredProfitCents: number }) {
  const sellingFeesCents = Math.round(input.resaleValueCents * input.sellingFeeBasisPoints / 10000);
  const nonPurchaseCostsCents = sellingFeesCents + input.shippingCents + input.cleaningRepairCents + input.authenticationCents;
  const totalCostCents = input.purchasePriceCents + nonPurchaseCostsCents;
  const profitCents = input.resaleValueCents - totalCostCents;
  return { totalCostCents, profitCents, roiBasisPoints: totalCostCents ? Math.round(profitCents * 10000 / totalCostCents) : null, maximumBidCents: Math.max(0, input.resaleValueCents - nonPurchaseCostsCents - input.desiredProfitCents) };
}

export function accuracyMetrics(values: Array<{ predictedCents: number; actualCents: number; predictedProfitCents: number; actualProfitCents: number; maximumBidCents: number; purchasePriceCents: number; daysHeld: number }>, toleranceBasisPoints = 1500) {
  const median = (xs: number[]) => { const sorted = [...xs].sort((a,b)=>a-b); return sorted.length ? (sorted[Math.floor((sorted.length-1)/2)] + sorted[Math.ceil((sorted.length-1)/2)]) / 2 : 0; };
  const resaleErrors = values.map(x => Math.abs(x.actualCents-x.predictedCents));
  const profitErrors = values.map(x => x.actualProfitCents-x.predictedProfitCents);
  const rate = (predicate: (x: typeof values[number]) => boolean) => values.length ? Math.round(values.filter(predicate).length * 10000 / values.length) : 0;
  return { count: values.length, meanAbsoluteResaleValueErrorCents: values.length ? Math.round(resaleErrors.reduce((a,b)=>a+b,0)/values.length) : 0, medianAbsoluteResaleValueErrorCents: median(resaleErrors), meanProfitErrorCents: values.length ? Math.round(profitErrors.reduce((a,b)=>a+b,0)/values.length) : 0, medianProfitErrorCents: median(profitErrors), accuracyBasisPoints: rate(x => Math.abs(x.actualCents-x.predictedCents)*10000 <= Math.max(1,x.predictedCents)*toleranceBasisPoints), profitableBasisPoints: rate(x=>x.actualProfitCents>0), maximumBidComplianceBasisPoints: rate(x=>x.purchasePriceCents<=x.maximumBidCents), averageHoldingPeriodDays: values.length ? Math.round(values.reduce((s,x)=>s+x.daysHeld,0)/values.length) : 0 };
}

export const inventoryTransitions: Record<string, string[]> = {
  AWAITING_PAYMENT: ['AWAITING_SHIPMENT', 'RETURNED'], AWAITING_SHIPMENT: ['IN_TRANSIT', 'RETURNED'], IN_TRANSIT: ['RECEIVED', 'RETURNED'], RECEIVED: ['INSPECTION_REQUIRED', 'AUTHENTICATION_REQUIRED', 'CLEANING_REQUIRED', 'READY_TO_LIST'], INSPECTION_REQUIRED: ['AUTHENTICATION_REQUIRED', 'CLEANING_REQUIRED', 'READY_TO_LIST', 'RETURNED'], AUTHENTICATION_REQUIRED: ['CLEANING_REQUIRED', 'READY_TO_LIST', 'RETURNED'], CLEANING_REQUIRED: ['READY_TO_LIST', 'RETURNED'], READY_TO_LIST: ['LISTED'], LISTED: ['SOLD', 'RETURNED'], SOLD: ['CLOSED'], RETURNED: ['CLOSED'], CLOSED: [],
};
export const canTransitionInventory = (from: string, to: string) => inventoryTransitions[from]?.includes(to) ?? false;
