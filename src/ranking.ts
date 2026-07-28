import type {Analysis} from './types';
export function scoreAnalysis(a:Omit<Analysis,'score'|'label'|'reasons'>){
 const roi=Math.max(0,Math.min(100,(a.finance.roiBps??-1000)/50));
 const profit=Math.max(0,Math.min(100,a.finance.profitCents/500));
 const compCount=Math.min(100,a.comparables.length*20), range=a.estimates.expected?Math.min(100,(a.estimates.optimistic-a.estimates.conservative)*100/a.estimates.expected):100;
 const missing=[!a.product.title,a.product.currentBidCents==null,!a.product.listingUrl].filter(Boolean).length;
 const completeness=Math.max(0,100-missing*18-range*.45+(a.identification.userConfirmed?15:-15));
 const score=Math.round(Math.max(0,Math.min(100,.30*roi+.20*profit+.15*a.identification.identificationConfidence+.15*a.estimates.confidence+.10*a.product.extractionConfidence+.05*compCount+.05*completeness)));
 const label=score>=75?'Strong Buy Candidate':score>=60?'Worth Investigating':score>=45?'Watch':score>=30?'High Risk':'Pass';
 const reasons=[`Projected ROI contributes ${Math.round(.3*roi)} of 30 points.`,`Profit potential contributes ${Math.round(.2*profit)} of 20 points.`,`Confidence evidence contributes ${Math.round(.15*a.identification.identificationConfidence+.15*a.estimates.confidence+.10*a.product.extractionConfidence)} of 40 points.`,`${a.comparables.length} mock comparable records; resale range width is ${Math.round(range)}% of expected.`,a.identification.userConfirmed?'Identification confirmed by user.':'Identification is not confirmed; decision-ready status withheld.'];
 return{score,label,reasons};
}
export const rankAnalyses=(items:Analysis[])=>[...items].sort((a,b)=>b.score-a.score||b.finance.profitCents-a.finance.profitCents||(b.finance.roiBps??-Infinity)-(a.finance.roiBps??-Infinity));
