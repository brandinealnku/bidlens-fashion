import express from'express';
import{chromium}from'playwright';
import dns from'node:dns/promises';
import net from'node:net';
import path from'node:path';

const app=express();

app.use(express.json({limit:'8kb'}));
const blocked=ip=>{if(net.isIPv4(ip)){const p=ip.split('.').map(Number);
return p[0]===10||p[0]===127||p[0]===0||p[0]===169&&p[1]===254||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31}return ip==='::1'||/^f[cd]|^fe8/i.test(ip)};

async function safe(raw){let u;
try{u=new URL(raw)}catch{throw Error('Invalid URL.')}if(!['http:','https:'].includes(u.protocol)||!(u.hostname==='ebth.com'||u.hostname.endsWith('.ebth.com')))throw Error('Only public EBTH http(s) URLs are supported.');
const addresses=await dns.lookup(u.hostname,{all:true});
if(addresses.some(x=>blocked(x.address)))throw Error('Private or reserved destinations are blocked.');
return u}
app.post('/api/capture',async(req,res)=>{let browser;
try{await safe(req.body?.url);
browser=await chromium.launch({headless:true});
const tab=await browser.newPage({viewport:{width:1440,height:1000}});
let redirects=0;
tab.on('framenavigated',async frame=>{if(frame===tab.mainFrame()&&++redirects>6)await tab.close()});
await tab.goto(req.body.url,{waitUntil:'domcontentloaded',timeout:+process.env.CAPTURE_TIMEOUT_MS||20000});
await safe(tab.url());
for(let y=0;
y<5;
y++){await tab.evaluate(()=>scrollBy(0,innerHeight));
await tab.waitForTimeout(350)}await tab.evaluate(()=>scrollTo(0,0));
const cards=await tab.locator('[data-testid*="item"],article,.lot-card,[class*="product-card"],[class*="item-card"]').evaluateAll((els,source)=>els.slice(0,50).map((el,i)=>{const r=el.getBoundingClientRect(),a=el.querySelector('a[href]'),img=el.querySelector('img'),text=el.textContent||'',bid=text.match(/(?:current bid|bid)\s*\$?([\d,.]+)/i);
return{id:`live-${i+1}`,sourcePageUrl:source,listingUrl:a?.href,title:(el.querySelector('h2,h3,[class*="title"]')?.textContent||text.split('\n')[0])?.trim().slice(0,180),currentBidCents:bid?Math.round(parseFloat(bid[1].replace(',',''))*100):undefined,bidText:bid?.[0],imageUrl:img?.currentSrc||img?.src,screenshotBoundingBox:{x:Math.round(r.x),y:Math.round(r.y+scrollY),width:Math.round(r.width),height:Math.round(r.height)},extractionConfidence:bid&&img?85:55,extractionWarnings:[...(!bid?['Missing bid.']:[]),...(!a?['Missing listing URL.']:[])]}}),tab.url());
const body=await tab.locator('body').boundingBox(),shot=await tab.screenshot({fullPage:true,type:'jpeg',quality:72});
if(shot.length>(+process.env.MAX_SCREENSHOT_BYTES||12000000))throw Error('Screenshot exceeded the configured size limit.');
res.json({capture:{sourceUrl:tab.url(),pageTitle:(await tab.title()).replace(/[<>]/g,'').slice(0,200),capturedAt:new Date().toISOString(),width:Math.round(body?.width||1440),height:Math.min(12000,Math.round(body?.height||1000)),status:cards.length?'success':'partial',warnings:cards.length?[]:['No supported product-card structure was detected.'],screenshotUrl:`data:image/jpeg;base64,${shot.toString('base64')}`},products:cards})}catch(e){res.status(422).json({error:e.message||'Browser capture failed.'})}finally{await browser?.close()}});
app.use(express.static('dist'));
app.get('*',(req,res)=>res.sendFile(path.resolve('dist/index.html')));
app.listen(process.env.PORT||4174);

