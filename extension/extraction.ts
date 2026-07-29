import type{ExtractedEbthListing}from'./types';
export function isEbthUrl(value:string){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&(u.hostname==='ebth.com'||u.hostname.endsWith('.ebth.com'))}catch{return false}}
export function normalizeListingUrl(value:string,base='https://www.ebth.com/'){try{const u=new URL(value,base);u.hash='';return isEbthUrl(u.href)?u.href:undefined}catch{return undefined}}
export function itemId(url?:string){return url?.match(/\/items\/(\d+)(?:-|\/|$)/)?.[1]}
const MISSING_BID=/\b(?:no bids?|bid now|starting soon|closed|unavailable)\b/i;
export function parseCurrentBid(text?:string){if(!text||MISSING_BID.test(text)||(!/(?:bid|winning)/i.test(text)&&!/^\s*\$[\d,.]+\s*$/.test(text)))return undefined;const matches=[...text.matchAll(/\$\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)/g)];if(matches.length!==1)return undefined;const match=matches[0];const normalized=match[1].replaceAll(',',''),[whole,fraction='']=normalized.split('.');return Number(whole)*100+Number((fraction+'00').slice(0,2))}
export function sensitive(text:string){return /(?:password|credit\s*card|account\s*number|street\s+address|\bssn\b)/i.test(text)}
export function dedupe(listings:ExtractedEbthListing[]){const found=new Map<string,ExtractedEbthListing>();for(const x of listings){const key=x.ebthItemId||x.listingUrl||`${x.title?.trim().toLowerCase()}|${x.imageUrl}`||x.id,old=found.get(key);if(!old||((x.currentBidCents!=null?40:0)+x.extractionConfidence)>((old.currentBidCents!=null?40:0)+old.extractionConfidence))found.set(key,x)}return [...found.values()]}
export function confidence(x:Pick<ExtractedEbthListing,'title'|'listingUrl'|'imageUrl'|'currentBidCents'|'timeRemaining'>){return Math.min(100,(x.listingUrl?30:0)+(x.title?25:0)+(x.imageUrl?15:0)+(x.currentBidCents!=null?20:0)+(x.timeRemaining?10:0))}
export function detectLogin(title:string,url:string,text:string){return /sign[ -]?in|log[ -]?in/i.test(`${title} ${url}`)&&/password/i.test(text)}

const clean=(value?:string|null)=>(value||'').replace(/\s+/g,' ').trim();
export function extractBid(card:Element){
 const candidates:{text:string;method:string}[]=[];
 for(const el of card.querySelectorAll<HTMLElement>('[data-current-bid],[data-bid],[itemprop="price"],[aria-label]'))for(const attr of ['data-current-bid','data-bid','content','aria-label']){const text=clean(el.getAttribute(attr));if(text)candidates.push({text,method:`attribute:${attr}`})}
 for(const selector of ['[itemprop="price"]','[data-testid*="bid"]','[class*="current-bid"]','[class*="currentBid"]','[class*="bid"]'])for(const el of card.querySelectorAll<HTMLElement>(selector)){const text=clean(el.textContent);if(text)candidates.push({text,method:`selector:${selector}`})}
 const visible=clean((card as HTMLElement).innerText||card.textContent);candidates.push({text:visible,method:'card-text'});
 for(const candidate of candidates){const cents=parseCurrentBid(candidate.text);if(cents!=null||MISSING_BID.test(candidate.text)){const snippet=clean(candidate.text.match(/(?:current|winning|starting)?\s*bid(?:s)?\s*:?[^$]{0,12}\$[\d,.]+|\d+\s+bids?\s*[·|:-]?\s*\$[\d,.]+|\$[\d,.]+|no bids?|bid now|starting soon|closed|unavailable/i)?.[0]||candidate.text);return{bidText:snippet,currentBidCents:cents,bidLabel:snippet.match(/current bid|winning bid|starting bid|no bids?/i)?.[0],bidCount:Number(snippet.match(/(\d+)\s+bids?/i)?.[1])||undefined,method:candidate.method}}
 }
 return{method:'not-found'};
}
export function extractListings(root:Document|Element,sourcePageUrl:string):ExtractedEbthListing[]{
 const anchors=[...root.querySelectorAll<HTMLAnchorElement>('a[href*="/items/"]')];
 return dedupe(anchors.map((a,index)=>{let card:Element=a;for(let n=a.parentElement,depth=0;n&&depth<7;n=n.parentElement,depth++){if(n.querySelector('img')&&n.querySelectorAll('a[href*="/items/"]').length===1){card=n;break}}const url=normalizeListingUrl(a.href,sourcePageUrl),img=card.querySelector<HTMLImageElement>('img'),title=clean(a.getAttribute('aria-label')||a.textContent||img?.alt),bid=extractBid(card),raw=clean((card as HTMLElement).innerText||card.textContent),warnings:string[]=[];if(bid.currentBidCents==null)warnings.push(bid.bidText?`Bid status: ${bid.bidText}`:'Current bid was not detected.');const time=raw.match(/(?:time left|ends?|closing)\s*:?\s*[^|]{1,60}/i)?.[0];const x:ExtractedEbthListing={id:itemId(url)||`ebth-${index}`,sourcePageUrl,listingUrl:url,ebthItemId:itemId(url),title:title||undefined,imageUrl:img?.currentSrc||img?.src,bidText:bid.bidText,currentBidCents:bid.currentBidCents,bidLabel:bid.bidLabel,bidCount:bid.bidCount,priceText:bid.bidText,timeRemaining:time,endingText:time,cardText:sensitive(raw)?undefined:raw,extractionConfidence:0,extractionWarnings:warnings,extractionMethod:bid.method};x.extractionConfidence=confidence(x);return x}))
}
