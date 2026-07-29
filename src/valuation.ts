import type {ComparableSale,DetectedProduct,ProductIdentification,ResaleEstimate} from './types';

export const CATEGORY_BASELINES:Record<string,number>={handbag:18000,bag:16000,shoes:12000,footwear:12000,jewelry:19000,watch:24000,coat:17000,jacket:13000,dress:11000,sunglasses:9500,wallet:8500,scarf:7000,accessories:8000,apparel:7500,unknown:6500};
const BRAND_TIERS:{factor:number;names:string[]}[]=[{factor:2.5,names:['hermes','chanel','louis vuitton','tiffany','gucci','david yurman']},{factor:1.7,names:['burberry','max mara','prada','coach']},{factor:1.25,names:['kate spade','michael kors','ralph lauren']},{factor:.8,names:['zara','h&m','target']}];
const CONDITIONS:Record<string,number>={new:1.2,excellent:1.1,'very good':1,good:.85,fair:.65,damaged:.35,unknown:.8};
const KEYWORDS:Record<string,number>={leather:1.12,sterling:1.18,gold:1.45,cashmere:1.2,silk:1.12,vintage:1.08,'limited edition':1.25,signed:1.15,'authenticity card':1.12,'dust bag':1.06,box:1.05,repair:.72,damage:.58,wear:.86,missing:.7,faux:.72};
const round=(value:number)=>Math.max(100,Math.round(value/100)*100);
function includes(text:string,key:string){return new RegExp(`\\b${key.replace(' ','\\s+')}\\b`,'i').test(text)}
export function estimateResale(product:DetectedProduct,id:ProductIdentification,comparables:ComparableSale[]=[]):ResaleEstimate{
 const rationale:string[]=[],text=[product.title,id.proposedCategory,id.proposedProductType,id.proposedMaterial].filter(Boolean).join(' ').toLowerCase();
 if(comparables.length){const prices=comparables.map(c=>c.priceCents+(c.shippingCents||0)).sort((a,b)=>a-b),expected=prices[Math.floor(prices.length/2)];return{productId:product.id,conservativeCents:prices[0],expectedCents:expected,optimisticCents:prices.at(-1)!,estimateSource:'comparables',confidence:Math.min(90,60+comparables.length*5),rationale:[`${comparables.length} product-specific comparable records.`],comparableCount:comparables.length}}
 const category=Object.keys(CATEGORY_BASELINES).find(k=>k!=='unknown'&&includes(text,k))||'unknown';let value=CATEGORY_BASELINES[category];rationale.push(`${category} category baseline: $${value/100}.`);
 const brand=(id.proposedBrand||product.title||'').toLowerCase(),tier=BRAND_TIERS.find(t=>t.names.some(n=>brand.includes(n)));if(tier){value*=tier.factor;rationale.push(`Recognized brand tier adjustment: ${tier.factor}×.`)}
 const condition=(id.proposedCondition||'unknown').toLowerCase(),conditionFactor=CONDITIONS[condition]||CONDITIONS.unknown;value*=conditionFactor;rationale.push(`${condition} condition adjustment: ${conditionFactor}×.`);
 for(const [keyword,factor] of Object.entries(KEYWORDS))if(includes(text,keyword)){value*=factor;rationale.push(`“${keyword}” title/detail adjustment: ${factor}×.`)}
 const expected=round(value),confidence=Math.min(68,32+(category!=='unknown'?14:0)+(tier?10:0)+(id.identificationConfidence||0)/10);if(product.currentBidCents!=null&&product.currentBidCents>expected)rationale.push('Current bid is above the heuristic estimate; overbid risk requires review.');
 return{productId:product.id,conservativeCents:round(expected*.7),expectedCents:expected,optimisticCents:round(expected*1.3),estimateSource:category==='unknown'?'title-heuristic':'category-model',confidence:Math.round(confidence),rationale,comparableCount:0};
}
export function preserveLockedEstimate(estimate:ResaleEstimate,locked:boolean,values:{conservativeCents:number;expectedCents:number;optimisticCents:number}):ResaleEstimate{return locked?{...estimate,...values,estimateSource:'user-entered',rationale:['User-entered resale range is locked.']}:estimate}
