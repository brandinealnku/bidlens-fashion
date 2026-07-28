export const blockedHost=(h:string)=>h==='localhost'||h.endsWith('.localhost')||h==='0.0.0.0'||h==='169.254.169.254'||h==='metadata.google.internal'||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h)||h==='::1'||h.startsWith('fc')||h.startsWith('fd')||h.startsWith('fe80:');
export function validateAuctionUrl(value:string){
 if(!value.trim()) return{ok:false,error:'Enter an EBTH webpage URL.'};
 let url:URL; try{url=new URL(value)}catch{return{ok:false,error:'Enter a complete, properly formatted URL.'}}
 if(!['http:','https:'].includes(url.protocol))return{ok:false,error:'Only http and https URLs are supported.'};
 if(blockedHost(url.hostname.toLowerCase()))return{ok:false,error:'Private, local, link-local, and metadata destinations are blocked.'};
 if(url.hostname!=='ebth.com'&&!url.hostname.endsWith('.ebth.com'))return{ok:false,error:'This focused MVP currently supports public EBTH pages only.'};
 return{ok:true,url:url.toString()};
}
