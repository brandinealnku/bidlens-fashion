import { describe, expect, it } from 'vitest';
import { accuracyMetrics, bidHeadroomCents, calculateScenario, canTransitionInventory, evaluateCondition, scoreOpportunity } from '@/lib/v3/intelligence';
const profile={minimumProfitCents:5000,minimumRoiBasisPoints:3000,maximumPurchasePriceCents:50000,maximumRiskLevel:'MEDIUM' as const,preferredBrands:['Coach'],excludedBrands:['Counterfeit Co'],preferredCategories:['HANDBAGS']};
const opportunity={currentBidCents:10000,maximumBidCents:25000,expectedProfitCents:12000,expectedRoiBasisPoints:5000,confidenceBasisPoints:8500,comparableCount:4,riskLevel:'LOW' as const,brand:'Coach',category:'HANDBAGS'};
describe('V3 decision intelligence',()=>{
  it('calculates signed bid headroom in cents',()=>expect(bidHeadroomCents(24500,20000)).toBe(4500));
  it('keeps market scoring independent and personalizes preferred brands',()=>{const favored=scoreOpportunity(opportunity,profile);const neutral=scoreOpportunity({...opportunity,brand:'Other'},profile);expect(favored.marketScore).toBe(neutral.marketScore);expect(favored.personalScore).toBeGreaterThan(neutral.personalScore);expect(favored.positiveFactors.length).toBeGreaterThan(0)});
  it('applies risk and excluded-brand penalties',()=>expect(scoreOpportunity({...opportunity,brand:'Counterfeit Co',riskLevel:'HIGH'},profile).personalScore).toBeLessThan(scoreOpportunity(opportunity,profile).personalScore));
  it('evaluates deterministic rules',()=>expect(evaluateCondition({expectedProfitCents:4900},{field:'expectedProfitCents',operator:'LT',value:5000})).toBe(true));
  it('uses one shared scenario formula',()=>expect(calculateScenario({resaleValueCents:30000,purchasePriceCents:10000,sellingFeeBasisPoints:1000,shippingCents:2000,cleaningRepairCents:1000,authenticationCents:0,desiredProfitCents:5000})).toEqual({totalCostCents:16000,profitCents:14000,roiBasisPoints:8750,maximumBidCents:19000}));
  it('enforces inventory transitions',()=>{expect(canTransitionInventory('READY_TO_LIST','LISTED')).toBe(true);expect(canTransitionInventory('SOLD','IN_TRANSIT')).toBe(false)});
  it('reports transparent estimate accuracy and max-bid compliance',()=>{const m=accuracyMetrics([{predictedCents:10000,actualCents:11000,predictedProfitCents:3000,actualProfitCents:3500,maximumBidCents:5000,purchasePriceCents:4500,daysHeld:20}]);expect(m.accuracyBasisPoints).toBe(10000);expect(m.maximumBidComplianceBasisPoints).toBe(10000);expect(m.meanAbsoluteResaleValueErrorCents).toBe(1000)});
});
