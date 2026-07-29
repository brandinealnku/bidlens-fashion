export type Box={x:number;y:number;width:number;height:number};
export type ExtractedEbthListing={id:string;sourcePageUrl:string;listingUrl?:string;ebthItemId?:string;title?:string;imageUrl?:string;bidText?:string;currentBidCents?:number;bidLabel?:string;bidCount?:number;priceText?:string;timeRemaining?:string;endingText?:string;auctionEndIso?:string;shippingText?:string;pickupText?:string;categoryText?:string;cardText?:string;boundingBox?:Box;extractionConfidence:number;extractionWarnings:string[];extractionMethod?:string};
export type ScreenshotPart={index:number;dataUrl:string;width:number;height:number};
export type FullPageCapture={captureId:string;sourceUrl:string;pageTitle:string;capturedAt:string;status:'success'|'partial'|'failed';width:number;height:number;devicePixelRatio:number;screenshotDataUrl?:string;screenshotParts?:ScreenshotPart[];warnings:string[]};
export type CapturePayload=FullPageCapture&{listings:ExtractedEbthListing[];sessionId?:string};
export type Settings={appUrl:string;apiUrl:string;scrollDelayMs:number;maxScrollAttempts:number};
export const DEFAULT_SETTINGS:Settings={appUrl:'https://brandinealnku.github.io/bidlens-fashion/',apiUrl:'',scrollDelayMs:700,maxScrollAttempts:80};
