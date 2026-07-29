import type{Assumptions,DetectedProduct,ExtensionCapture}from'./types';
/** Normalize extension records without replacing a captured bid with a template value. */
export function importedProducts(capture:ExtensionCapture):DetectedProduct[]{return capture.listings.map(product=>({...product,userConfirmed:false,researchSelected:false}))}
export function importedAssumptions(product:DetectedProduct,template:Assumptions):Assumptions{return{...template,currentBidCents:product.currentBidCents}}
