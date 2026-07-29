import type {Assumptions,FinanceResult} from './types';
export const percent=(cents:number,bps:number)=>Math.round(cents*bps/10000);
export function calculateFinance(a:Assumptions):FinanceResult{
 const currentBidCents=a.currentBidCents??0;
 const buyerPremiumCents=percent(currentBidCents,a.buyerPremiumBps);
 const salesTaxCents=percent(currentBidCents+buyerPremiumCents,a.salesTaxBps);
 const acquisitionCents=currentBidCents+buyerPremiumCents+salesTaxCents+a.inboundShippingCents+a.otherAcquisitionCents;
 const marketplaceFeeCents=percent(a.expectedResaleCents,a.marketplaceFeeBps);
 const processingFeeCents=percent(a.expectedResaleCents,a.processingFeeBps);
 const netProceedsCents=a.expectedResaleCents-marketplaceFeeCents-processingFeeCents-a.outboundShippingCents-a.packagingCents;
 const profitCents=netProceedsCents-acquisitionCents;
 const roiBps=acquisitionCents>0?Math.round(profitCents*10000/acquisitionCents):null;
 const feeKeep=10000-a.marketplaceFeeBps-a.processingFeeBps;
 const breakEvenResaleCents=feeKeep>0?Math.ceil((acquisitionCents+a.outboundShippingCents+a.packagingCents)*10000/feeKeep):null;
 const fixedBuy=a.inboundShippingCents+a.otherAcquisitionCents;
 const taxMultiplier=10000+a.salesTaxBps;
 const premiumMultiplier=10000+a.buyerPremiumBps;
 const netForGoal=netProceedsCents-(a.maxBidMode==='profit'?a.desiredProfitCents:fixedBuy);
 let maximumBidCents:null|number=null;
 if(netForGoal>=0){
   if(a.maxBidMode==='profit') maximumBidCents=Math.max(0,Math.floor(((netForGoal-fixedBuy)*100000000)/(premiumMultiplier*taxMultiplier)));
   else { const roi=10000+a.desiredRoiBps; maximumBidCents=Math.max(0,Math.floor((((netProceedsCents*10000)-roi*fixedBuy)*100000000)/(roi*premiumMultiplier*taxMultiplier))); }
 }
 return{buyerPremiumCents,salesTaxCents,acquisitionCents,marketplaceFeeCents,processingFeeCents,netProceedsCents,profitCents,roiBps,breakEvenResaleCents,maximumBidCents};
}
