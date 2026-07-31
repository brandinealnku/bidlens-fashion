export type OcrBoundingBox={x:number;y:number;width:number;height:number};
export type OcrLine={text:string;confidence:number;boundingBox:OcrBoundingBox};
export type ParsedScreenshot={brand?:string;title?:string;currentBidCents?:number;bidCount?:number;shippingCents?:number;condition?:string;category?:string};
export type FieldConfidence={brand:number;title:number;currentBid:number;bidCount:number;shipping:number};
export type OcrResult={rawText:string;lines:OcrLine[];parsed:ParsedScreenshot;confidence:FieldConfidence};
export type OcrProgress={stage:'Preparing image'|'Reading screenshot'|'Finding listing details'|'Complete';progress?:number};
export type RescanTarget='title'|'bid'|'full';
