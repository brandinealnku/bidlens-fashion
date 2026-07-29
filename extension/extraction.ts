import type{ExtractedEbthListing}from'./types';
export function isEbthUrl(value:string){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&(u.hostname==='ebth.com'||u.hostname.endsWith('.ebth.com'))}catch{return false}}
export function normalizeListingUrl(value:string,base='https://www.ebth.com/'){try{const u=new URL(value,base);u.hash='';return isEbthUrl(u.href)?u.href:undefined}catch{return undefined}}
export function itemId(url?:string){return url?.match(/\/items\/(\d+)(?:-|\/|$)/)?.[1]}
export function parseCurrentBid(text:string){if(!/(?:current\s+bid|\bbid)\s*:?\s*\$/i.test(text)&&!/^\s*\$[\d,.]+\s*$/.test(text))return undefined;const values=[...text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)];if(values.length!==1)return undefined;const n=Number(values[0][1].replaceAll(',',''));return Number.isFinite(n)?Math.round(n*100):undefined}
export function sensitive(text:string){return /(?:password|credit\s*card|account\s*number|street\s+address|\bssn\b)/i.test(text)}
export function dedupe(listings:ExtractedEbthListing[]){const seen=new Set<string>();return listings.filter(x=>{const key=x.ebthItemId||x.listingUrl||`${x.title?.trim().toLowerCase()}|${x.imageUrl}`||x.id;if(seen.has(key))return false;seen.add(key);return true})}
export function confidence(x:Pick<ExtractedEbthListing,'title'|'listingUrl'|'imageUrl'|'currentBidCents'|'timeRemaining'>){return Math.min(100,(x.listingUrl?30:0)+(x.title?25:0)+(x.imageUrl?15:0)+(x.currentBidCents!=null?20:0)+(x.timeRemaining?10:0))}
export function detectLogin(title:string,url:string,text:string){return /sign[ -]?in|log[ -]?in/i.test(`${title} ${url}`)&&/password/i.test(text)}
