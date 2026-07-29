import type{ExtractedEbthListing}from'./types';
export function isEbthUrl(value:string){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&(u.hostname==='ebth.com'||u.hostname.endsWith('.ebth.com'))}catch{return false}}
export function normalizeListingUrl(value:string,base='https://www.ebth.com/'){try{const u=new URL(value,base);u.hash='';return isEbthUrl(u.href)?u.href:undefined}catch{return undefined}}
export function itemId(url?:string){return url?.match(/\/items\/(\d+)(?:-|\/|$)/)?.[1]}
const MISSING_BID=/\b(?:no bids?|bid now|starting soon|closed|unavailable)\b/i;
const MONEY='((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)';
const LABELED_BID=new RegExp('(?:current|winning|starting)\\s+bid[\\s\\S]{0,80}?\\$\\s*'+MONEY,'i');
const GENERIC_BID=new RegExp('\\$\\s*'+MONEY,'i');
const cents=(amount:string)=>{const [whole,fraction='']=amount.replaceAll(',','').split('.');return Number(whole)*100+Number((fraction+'00').slice(0,2))};
export function parseCurrentBid(text?:string){if(!text||MISSING_BID.test(text))return undefined;const labeled=text.match(LABELED_BID);if(labeled)return cents(labeled[1]);if(!/(?:bid|winning)/i.test(text)&&!/^\s*\$[\d,.]+\s*$/.test(text))return undefined;const values=[...text.matchAll(new RegExp(GENERIC_BID.source,'gi'))];return values.length===1?cents(values[0][1]):undefined}
export function sensitive(text:string){return /(?:password|credit\s*card|account\s*number|street\s+address|\bssn\b)/i.test(text)}
export function dedupe(listings:ExtractedEbthListing[]){const found=new Map<string,ExtractedEbthListing>();for(const x of listings){const key=x.ebthItemId||x.listingUrl||`${x.title?.trim().toLowerCase()}|${x.imageUrl}`||x.id,old=found.get(key);if(!old||((x.currentBidCents!=null?40:0)+x.extractionConfidence)>((old.currentBidCents!=null?40:0)+old.extractionConfidence))found.set(key,x)}return [...found.values()]}
export function confidence(x:Pick<ExtractedEbthListing,'title'|'listingUrl'|'imageUrl'|'currentBidCents'|'timeRemaining'>){return Math.min(100,(x.listingUrl?30:0)+(x.title?25:0)+(x.imageUrl?15:0)+(x.currentBidCents!=null?20:0)+(x.timeRemaining?10:0))}
export function detectLogin(title:string,url:string,text:string){return /sign[ -]?in|log[ -]?in/i.test(`${title} ${url}`)&&/password/i.test(text)}

const clean=(value?:string|null)=>(value||'').replace(/\s+/g,' ').trim();
const visibleText=(element:Element)=>((element as HTMLElement).innerText||element.textContent||'');
export function containerItemIds(element:Element){return new Set([...element.querySelectorAll<HTMLAnchorElement>('a[href*="/items/"]')].map(a=>itemId(a.href)).filter((id):id is string=>!!id))}
export function findListingContainer(anchor:HTMLAnchorElement):Element{
 let best:Element=anchor,bestScore=-Infinity;
 for(let candidate:Element|null=anchor.parentElement,depth=0;candidate&&depth<12;candidate=candidate.parentElement,depth++){
  const text=visibleText(candidate),ids=containerItemIds(candidate),links=candidate.querySelectorAll('a[href*="/items/"]');
  if(ids.size>1)continue;
  let score=0;
  if(/current\s+bid/i.test(text))score+=50;
  if(/place\s+bid/i.test(text))score+=20;
  if(candidate.querySelector('img'))score+=15;
  if(/\bITMG[A-Z0-9]+\b/i.test(text))score+=15;
  if(/\b(?:hours?|minutes?)\s+left\b|\b(?:ends?|ending|closing)\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\s+\d{4}\b/i.test(text))score+=10;
  if(ids.size===1&&links.length)score+=10;
  // A labeled amount and title/image evidence distinguish a row from a partial column.
  if(LABELED_BID.test(text))score+=15;
  if(score>bestScore){best=candidate;bestScore=score}
 }
 return best;
}
export function extractBid(card:Element){
 const rowText=visibleText(card),labeled=rowText.match(LABELED_BID),bidCount=Number(rowText.match(/(\d+)\s+bids?\b/i)?.[1])||undefined;
 if(labeled)return{bidText:clean(labeled[0]),currentBidCents:cents(labeled[1]),bidLabel:clean(labeled[0].match(/(?:current|winning|starting)\s+bid/i)?.[0]),bidCount,method:'row-text:labeled-bid',rawMatch:labeled[0]};
 const candidates:{text:string;method:string}[]=[];
 for(const el of card.querySelectorAll<HTMLElement>('[data-current-bid],[data-bid],[itemprop="price"],[aria-label]'))for(const attr of ['data-current-bid','data-bid','content','aria-label']){const text=clean(el.getAttribute(attr));if(text)candidates.push({text,method:`attribute:${attr}`})}
 for(const selector of ['[itemprop="price"]','[data-testid*="bid"]','[class*="current-bid"]','[class*="currentBid"]','[class*="bid"]'])for(const el of card.querySelectorAll<HTMLElement>(selector)){const text=clean(el.textContent);if(text)candidates.push({text,method:`selector:${selector}`})}
 candidates.push({text:rowText,method:'row-text:fallback'});
 for(const candidate of candidates){const value=parseCurrentBid(candidate.text);if(value!=null||MISSING_BID.test(candidate.text)){const raw=candidate.text.match(/\$\s*[\d,.]+|no bids?|bid now|starting soon|closed|unavailable/i)?.[0]||candidate.text;return{bidText:clean(raw),currentBidCents:value,bidCount,method:candidate.method,rawMatch:raw}}}
 return{bidCount,method:'not-found',rawMatch:undefined};
}
export function extractListings(root:Document|Element,sourcePageUrl:string):ExtractedEbthListing[]{
 const anchors=[...root.querySelectorAll<HTMLAnchorElement>('a[href*="/items/"]')];
 return dedupe(anchors.map((a,index)=>{const card=findListingContainer(a),url=normalizeListingUrl(a.href,sourcePageUrl),img=card.querySelector<HTMLImageElement>('img'),title=clean(a.getAttribute('aria-label')||a.textContent||img?.alt),bid=extractBid(card),raw=clean(visibleText(card)),warnings:string[]=[];if(bid.currentBidCents==null)warnings.push(bid.bidText?`Bid status: ${bid.bidText}`:'Current bid was not detected.');const time=raw.match(/(?:\d+\s+(?:hours?|minutes?)\s+left|(?:time left|ends?|ending|closing)\s*:?\s*[^|]{1,60})/i)?.[0];const x:ExtractedEbthListing={id:itemId(url)||`ebth-${index}`,sourcePageUrl,listingUrl:url,ebthItemId:itemId(url),title:title||undefined,imageUrl:img?.currentSrc||img?.src,bidText:bid.bidText,currentBidCents:bid.currentBidCents,bidLabel:bid.bidLabel,bidCount:bid.bidCount,priceText:bid.bidText,timeRemaining:time,endingText:time,cardText:sensitive(raw)?undefined:raw,extractionConfidence:0,extractionWarnings:warnings,extractionMethod:bid.method};x.extractionConfidence=confidence(x);return x}))
}
